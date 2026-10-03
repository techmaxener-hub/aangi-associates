<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/audit.php';
require __DIR__ . '/lib/zip_reader.php';
require __DIR__ . '/lib/pdf_text.php';
require __DIR__ . '/lib/name_match.php';

// Bulk policy import: admin/staff/associate uploads a single .zip of
// policy PDFs (e.g. a folder of scanned/WhatsApp-received policy
// documents) instead of one PDF at a time. Two-step, same
// never-auto-save shape as policy_extract.php:
//
//   POST ?action=scan   — unzips, best-effort reads each PDF and SUGGESTS
//                         which existing client it belongs to (by name
//                         found inside the PDF, or failing that by the
//                         file's own name — see lib/name_match.php) and
//                         what its policy fields are. Nothing is saved
//                         yet. Returns a batch_id plus one row per file.
//   POST ?action=commit — the admin/staff's REVIEWED, possibly-edited
//                         decisions (which client each file actually
//                         belongs to, corrected fields) are what actually
//                         get written: one client_policies row + one
//                         documents row (the original PDF) per accepted
//                         file.
//
// The uploaded zip is kept on disk between scan and commit (under
// uploads/bulk_imports/{batch_id}/) so commit can re-read each entry's
// original bytes without the browser re-uploading anything — cleaned up
// right after a successful commit, and opportunistically garbage-collected
// (anything older than 24h) at the top of every request in case a batch is
// scanned and never committed.

$user = require_login();
if ($user['role'] === 'client') json_error('Forbidden', 403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);

$action = $_GET['action'] ?? 'scan';
$batchRoot = __DIR__ . '/uploads/bulk_imports';
if (!is_dir($batchRoot)) mkdir($batchRoot, 0755, true);

// --- opportunistic cleanup of abandoned batches (>24h old) ------------------
foreach (glob("$batchRoot/*", GLOB_ONLYDIR) ?: [] as $dir) {
    $manifestPath = "$dir/manifest.json";
    $cutoff = time() - 86400;
    $stamp = is_file($manifestPath) ? filemtime($manifestPath) : filemtime($dir);
    if ($stamp !== false && $stamp < $cutoff) {
        @unlink("$dir/archive.zip");
        @unlink($manifestPath);
        @rmdir($dir);
    }
}

if ($action === 'scan') {
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('A .zip file is required', 422);
    }
    $file = $_FILES['file'];
    // A folder of PDFs compresses poorly (PDFs are already compressed
    // internally), so this cap is generous relative to the 10MB single-file
    // cap, not a multiple of it.
    if ($file['size'] > 40 * 1024 * 1024) json_error('ZIP file too large (40MB max)', 422);

    $head = file_get_contents($file['tmp_name'], false, null, 0, 4);
    if (!in_array($head, ["PK\x03\x04", "PK\x05\x06"], true)) {
        json_error('That does not look like a ZIP file', 422);
    }

    $bytes = file_get_contents($file['tmp_name']);
    if ($bytes === false) json_error('Could not read the uploaded file', 500);

    $zip = zip_list_entries($bytes);
    if (!$zip['ok']) json_error($zip['error'], 422);

    $clients = accessible_clients_list($user);
    $batchId = uuid4();
    $batchDir = "$batchRoot/$batchId";
    mkdir($batchDir, 0755, true);
    file_put_contents("$batchDir/archive.zip", $bytes);

    $results = [];
    $pdfCount = 0;
    foreach ($zip['entries'] as $entry) {
        $name = $entry['name'];
        $base = basename($name);
        if (strtolower((string) pathinfo($base, PATHINFO_EXTENSION)) !== 'pdf') {
            $results[] = ['entry_name' => $name, 'status' => 'skipped', 'skip_reason' => 'Not a PDF — add it to the client\'s Documents tab by hand instead'];
            continue;
        }
        // A reasonable ceiling on how many files one batch processes keeps a
        // mis-sized ZIP (hundreds of files) from timing out a single request.
        if (++$pdfCount > 100) {
            $results[] = ['entry_name' => $name, 'status' => 'skipped', 'skip_reason' => 'Batch limit of 100 PDFs reached — import this one separately'];
            continue;
        }
        if ($entry['size'] > 10 * 1024 * 1024) {
            $results[] = ['entry_name' => $name, 'status' => 'skipped', 'skip_reason' => 'File too large (10MB max per PDF)'];
            continue;
        }
        $pdfBytes = zip_read_entry($bytes, $entry);
        if ($pdfBytes === null) {
            $results[] = ['entry_name' => $name, 'status' => 'skipped', 'skip_reason' => 'Unsupported compression method in this ZIP for this file — try re-zipping with a different tool'];
            continue;
        }

        $extracted = pdf_extract_text($pdfBytes);
        $fields = pdf_guess_policy_fields($extracted['text']);

        // Prefer a name found INSIDE the PDF; fall back to the filename only
        // if the PDF itself yielded nothing (its own confidence/accuracy for
        // a name is unknown either way, so both are offered to the match
        // step and the better-scoring one wins).
        $candidates = array_filter([$fields['insured_name'], name_candidate_from_filename($base)]);
        $bestMatch = null;
        foreach ($candidates as $candidate) {
            $m = match_client_by_name($candidate, $clients);
            if ($m && (!$bestMatch || $m['score'] > $bestMatch['score'])) $bestMatch = $m;
        }

        $results[] = [
            'entry_name' => $name,
            'status' => 'ready',
            'low_confidence' => $extracted['low_confidence'],
            'fields' => $fields,
            'suggested_client_id' => $bestMatch['client_id'] ?? null,
            'suggested_client_name' => $bestMatch['full_name'] ?? null,
            'match_score' => $bestMatch['score'] ?? null,
        ];
    }

    file_put_contents("$batchDir/manifest.json", json_encode([
        'batch_id' => $batchId,
        'created_by' => $user['id'],
        'created_at' => gmdate('c'),
        'entries' => $zip['entries'],
    ]));

    json_out(['batch_id' => $batchId, 'files' => $results]);
}

if ($action === 'commit') {
    $body = json_input();
    $batchId = $body['batch_id'] ?? null;
    if (!$batchId || !preg_match('/^[a-f0-9-]{36}$/', $batchId)) json_error('batch_id is required', 422);
    $batchDir = "$batchRoot/$batchId";
    $manifestPath = "$batchDir/manifest.json";
    $zipPath = "$batchDir/archive.zip";
    if (!is_file($manifestPath) || !is_file($zipPath)) {
        json_error('This import batch has expired or was already completed — please re-upload the ZIP', 404);
    }
    $manifest = json_decode((string) file_get_contents($manifestPath), true);
    if (!$manifest || (!is_back_office($user) && $manifest['created_by'] !== $user['id'])) {
        json_error('Forbidden', 403);
    }
    $zipBytes = (string) file_get_contents($zipPath);
    $entriesByName = [];
    foreach ($manifest['entries'] as $e) $entriesByName[$e['name']] = $e;

    $decisions = $body['decisions'] ?? [];
    if (!is_array($decisions) || !$decisions) json_error('decisions is required', 422);

    $imported = [];
    $errors = [];
    $uploadDir = __DIR__ . '/uploads/documents';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    foreach ($decisions as $d) {
        $entryName = $d['entry_name'] ?? null;
        $clientId = $d['client_id'] ?? null;
        if (!$entryName || !$clientId) continue; // no client chosen = explicitly skipped by the reviewer
        if (!isset($entriesByName[$entryName])) { $errors[] = ['entry_name' => $entryName, 'error' => 'Not found in this batch']; continue; }

        try {
            assert_can_access_client($user, $clientId);
        } catch (Throwable $e) {
            $errors[] = ['entry_name' => $entryName, 'error' => 'Forbidden for this client'];
            continue;
        }

        $pdfBytes = zip_read_entry($zipBytes, $entriesByName[$entryName]);
        if ($pdfBytes === null) { $errors[] = ['entry_name' => $entryName, 'error' => 'Could not re-read this file from the archive']; continue; }

        // 1. The policy row — same column set/defaults as client_policies.php's POST.
        $policyId = uuid4();
        $policyData = [
            'client_id' => $clientId,
            'policy_number' => $d['policy_number'] ?? null,
            'insurer' => $d['insurer'] ?? 'TATA AIA',
            'product_type' => $d['product_type'] ?? null,
            'sum_assured' => $d['sum_assured'] ?? null,
            'premium' => $d['premium'] ?? null,
            'start_date' => $d['start_date'] ?? null,
            'renewal_date' => $d['renewal_date'] ?? null,
            'category_id' => $d['category_id'] ?? null,
        ];
        if (!$policyData['product_type']) { $errors[] = ['entry_name' => $entryName, 'error' => 'product_type is required']; continue; }
        db()->prepare(
            'INSERT INTO client_policies (id, client_id, policy_number, insurer, product_type, sum_assured, premium, start_date, renewal_date, category_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$policyId, $clientId, $policyData['policy_number'], $policyData['insurer'], $policyData['product_type'], $policyData['sum_assured'], $policyData['premium'], $policyData['start_date'], $policyData['renewal_date'], $policyData['category_id']]);
        log_audit('client_policies', $policyId, 'insert', null, $policyData + ['id' => $policyId]);

        // 2. The original PDF, filed the same way a manual Documents-tab upload is.
        $docId = uuid4();
        $ext = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($entryName, PATHINFO_EXTENSION));
        $storedName = $docId . ($ext ? ".$ext" : '');
        file_put_contents("$uploadDir/$storedName", $pdfBytes);
        db()->prepare(
            'INSERT INTO documents (id, client_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([$docId, $clientId, basename($entryName), $storedName, 'application/pdf', strlen($pdfBytes), $user['id']]);

        $imported[] = ['entry_name' => $entryName, 'policy_id' => $policyId, 'document_id' => $docId];
    }

    // Batch is fully spent after one commit — matches policy_extract.php's
    // "never let a stale guess be reused" posture, just at the batch level.
    @unlink($zipPath);
    @unlink($manifestPath);
    @rmdir($batchDir);

    json_out(['imported' => $imported, 'errors' => $errors]);
}

json_error('Unknown action', 422);
