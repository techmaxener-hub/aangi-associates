<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';

// Mirrors IntegrationCard.tsx (load one by provider, upsert). RLS this
// replaces (0002_integrations_and_leads.sql): admin-only, full access.
// credentials is stored as plain JSON here too — same "RLS/auth-gated but
// not Vault-grade encryption at rest" caveat the original schema noted.

$user = require_role('admin');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $provider = $_GET['provider'] ?? null;
    if ($provider) {
        $stmt = db()->prepare('SELECT status, credentials FROM integration_settings WHERE provider = ?');
        $stmt->execute([$provider]);
        $row = $stmt->fetch();
        if ($row) $row['credentials'] = json_decode($row['credentials'], true);
        json_out($row ?: null);
    }
    $rows = db()->query('SELECT provider, category, display_name, status, updated_at FROM integration_settings')->fetchAll();
    json_out($rows);
}

if ($method === 'POST') {
    $body = json_input();
    foreach (['provider', 'category', 'display_name'] as $required) {
        if (empty($body[$required])) json_error("$required is required", 422);
    }
    $stmt = db()->prepare(
        'INSERT INTO integration_settings (provider, category, display_name, status, credentials, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE category = VALUES(category), display_name = VALUES(display_name),
           status = VALUES(status), credentials = VALUES(credentials), updated_by = VALUES(updated_by), updated_at = UTC_TIMESTAMP()'
    );
    $stmt->execute([
        $body['provider'],
        $body['category'],
        $body['display_name'],
        $body['status'] ?? 'connected',
        json_encode($body['credentials'] ?? []),
        $user['id'] ?? null,
    ]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
