<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors ErrorBoundary.tsx (insert) and an admin-only read (no CRM page
// exists for this yet, same as before the migration — direct DB access
// was the only way to read these). RLS this replaces (0008_error_logs.sql):
// any authenticated user can insert; admin-only select.
//
// Improvement over the original: user_id is now actually set from the
// session (the old frontend never passed one despite the column existing).

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $body = json_input();
    if (empty($body['message'])) json_error('message is required', 422);
    $newId = uuid4();
    db()->prepare('INSERT INTO app_errors (id, message, stack, component_stack, url, user_id) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$newId, $body['message'], $body['stack'] ?? null, $body['component_stack'] ?? null, $body['url'] ?? null, $user['id']]);
    json_out(['ok' => true], 201);
}

if ($method === 'GET') {
    require_role('admin');
    json_out(db()->query('SELECT * FROM app_errors ORDER BY created_at DESC LIMIT 200')->fetchAll());
}

json_error('Method not allowed', 405);
