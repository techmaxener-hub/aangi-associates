<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/pdf_text.php';

// Mirrors the "Upload Policy PDF" button in PoliciesTab (ClientDetailPage.tsx).
// Read-only and best-effort: this NEVER writes to client_policies or the
// document vault itself — it only returns a best guess at the policy's
// fields so the browser can pre-fill the existing Add-Policy form for a
// human to check and submit. See lib/pdf_text.php's header for exactly
// what kind of PDF this can and can't read.
//
// Same client-scoping shape as documents.php/client_policies.php: admin,
// staff and the owning associate only — never a client, never someone
// else's client.

$user = require_login();
if ($user['role'] === 'client') json_error('Forbidden', 403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);

$clientId = $_POST['client_id'] ?? null;
if (!$clientId) json_error('client_id is required', 422);
assert_can_access_client($user, $clientId);

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

json_out([
    'low_confidence' => $result['low_confidence'] || $foundCount === 0,
    'fields_found' => $foundCount,
    'fields' => $fields,
    // A short preview so the UI can show "here's what we read" context —
    // never the full document text, which could be long and isn't needed
    // once the fields above are shown in the editable form.
    'text_preview' => mb_substr($result['text'], 0, 500),
]);
