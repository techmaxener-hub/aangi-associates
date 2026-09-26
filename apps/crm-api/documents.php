<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Client-facing document vault (policy PDFs, ID proof, etc). Files live
// on disk under uploads/documents/ — that folder has its own .htaccess
// denying direct web access, so the ONLY way to read a file's bytes is
// through the download action below, which re-checks access per request
// the same way assert_can_access_client() gates every other client-scoped
// endpoint. Upload is admin/staff/associate-only (same shape as
// communications.php); a client can list + download their own only.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$uploadDir = __DIR__ . '/uploads/documents';

function safe_stored_name(string $id, string $originalName): string
{
    $ext = pathinfo($originalName, PATHINFO_EXTENSION);
    $ext = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
    return $id . ($ext ? ".$ext" : '');
}

if ($method === 'GET' && !empty($_GET['download'])) {
    $stmt = db()->prepare('SELECT * FROM documents WHERE id = ?');
    $stmt->execute([$_GET['download']]);
    $doc = $stmt->fetch();
    if (!$doc) json_error('Not found', 404);
    assert_can_access_client($user, $doc['client_id']);

    $path = "$uploadDir/{$doc['stored_name']}";
    if (!is_file($path)) json_error('File missing on server', 404);

    header('Content-Type: ' . ($doc['mime_type'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', $doc['original_name']) . '"');
    header('Content-Length: ' . (string) filesize($path));
    readfile($path);
    exit;
}

if ($method === 'GET') {
    $clientId = $_GET['client_id'] ?? null;
    if (!$clientId) json_error('client_id is required', 422);
    assert_can_access_client($user, $clientId);
    $stmt = db()->prepare(
        'SELECT d.id, d.client_id, d.original_name, d.mime_type, d.size_bytes, d.created_at,
                u.full_name AS uploaded_by_name
         FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
         WHERE d.client_id = ? ORDER BY d.created_at DESC'
    );
    $stmt->execute([$clientId]);
    json_out($stmt->fetchAll());
}

if ($method === 'POST') {
    if ($user['role'] === 'client') json_error('Forbidden', 403);
    $clientId = $_POST['client_id'] ?? null;
    if (!$clientId) json_error('client_id is required', 422);
    assert_can_access_client($user, $clientId);

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('A file is required', 422);
    }
    $file = $_FILES['file'];
    // 10MB cap — plenty for a policy PDF or a photographed ID, and keeps
    // this simple (no chunked upload, no separate storage quota system).
    if ($file['size'] > 10 * 1024 * 1024) json_error('File too large (10MB max)', 422);

    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $newId = uuid4();
    $storedName = safe_stored_name($newId, $file['name']);
    if (!move_uploaded_file($file['tmp_name'], "$uploadDir/$storedName")) {
        json_error('Failed to save file', 500);
    }

    db()->prepare(
        'INSERT INTO documents (id, client_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([$newId, $clientId, $file['name'], $storedName, $file['type'] ?: null, $file['size'], $user['id']]);

    json_out(['id' => $newId], 201);
}

if ($method === 'DELETE') {
    if (!in_array($user['role'], ['admin', 'staff'], true)) json_error('Forbidden', 403);
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('id is required', 422);
    $stmt = db()->prepare('SELECT stored_name FROM documents WHERE id = ?');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) json_error('Not found', 404);

    db()->prepare('DELETE FROM documents WHERE id = ?')->execute([$id]);
    $path = "$uploadDir/{$doc['stored_name']}";
    if (is_file($path)) unlink($path);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
