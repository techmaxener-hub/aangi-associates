<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/pdf_text.php';
require __DIR__ . '/lib/name_match.php';

// Mirrors the "Upload Policy PDF" button in PoliciesTab (ClientDetailPage.tsx)
// AND the "+ Add Policy PDF" quick-add on the My Clients list
// (ClientsListPage.tsx). Read-only and best-effort: this NEVER writes to
// client_policies or the document vault itself — it only returns a best
// guess at the policy's fields so the browser can pre-fill the Add-Policy
// form for a human to check and submit. See lib/pdf_text.php's header for
// exactly what kind of PDF this can and can't read.
//
// client_id is OPTIONAL. Called from inside a specific client's page, the
// caller already knows who the policy belongs to and passes it — same
// client-scoping shape as documents.php/client_policies.php (admin, staff,
// and the owning associate only). Called from the list-level quick-add
// (no client chosen yet), it's omitted: the PDF's insured name (or, failing
// that, its filename) is matched against every client this user may assign
// a policy to, same name-matching bulk_policy_import.php's ZIP scan
// already does — just for one file instead of many, and only ever a
// suggestion the human reviews before saving, never an auto-assignment.

$user = require_login();
if ($user['role'] === 'client') json_error('Forbidden', 403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);

$clientId = $_POST['client_id'] ?? null;
if ($clientId) assert_can_access_client($user, $clientId);

if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    json_error('A file is required', 422);
}
$file = $_FILES['file'];
if ($file['size'] > 10 * 1024 * 1024) json_error('File too large (10MB max)', 422);

$ext = strtolower((string) pathinfo($file['name'], PATHINFO_EXTENSION));
$looksLikePdf = $ext === 'pdf';
if ($looksLikePdf) {
    // Belt-and-braces: trust the file's own magic bytes over its extension —
    // a renamed .pdf can't actually be parsed as one.
    $head = file_get_contents($file['tmp_name'], false, null, 0, 5);
    $looksLikePdf = $head === '%PDF-';
}
if (!$looksLikePdf) json_error('Only PDF files can be read automatically — upload it as a document instead and enter the policy details by hand', 422);

$bytes = file_get_contents($file['tmp_name']);
if ($bytes === false) json_error('Could not read the uploaded file', 500);

$result = pdf_extract_text($bytes);
$fields = pdf_guess_policy_fields($result['text']);
$foundCount = count(array_filter($fields, fn ($v) => $v !== null));

$response = [
    'low_confidence' => $result['low_confidence'] || $foundCount === 0,
    'fields_found' => $foundCount,
    'fields' => $fields,
    // A short preview so the UI can show "here's what we read" context —
    // never the full document text, which could be long and isn't needed
    // once the fields above are shown in the editable form.
    'text_preview' => mb_substr($result['text'], 0, 500),
];

if (!$clientId) {
    $clients = accessible_clients_list($user);
    $candidates = array_filter([$fields['insured_name'], name_candidate_from_filename($file['name'])]);
    $bestMatch = null;
    foreach ($candidates as $candidate) {
        $m = match_client_by_name($candidate, $clients);
        if ($m && (!$bestMatch || $m['score'] > $bestMatch['score'])) $bestMatch = $m;
    }
    $response['suggested_client_id'] = $bestMatch['client_id'] ?? null;
    $response['suggested_client_name'] = $bestMatch['full_name'] ?? null;
    $response['match_score'] = $bestMatch['score'] ?? null;
}

json_out($response);
