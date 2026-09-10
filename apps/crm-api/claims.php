<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/audit.php';

// Mirrors ClientDetailPage.tsx's ClaimsTab (list by client, file, advance),
// useMyClient.ts (client-portal self read), and ClaimsQueuePage.tsx (the
// admin/staff-wide "Claims Queue" — no client_id, joined to clients,
// returned under the `clients` key to match the frontend's
// `c.clients?.full_name` access exactly).
//
// RLS this replaces (0004_crm_core.sql): admin/staff full CRUD; associate
// select-only via clients.owner_id; client select-only via
// clients.portal_user_id. One of the 4 audited tables.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$clientId = $_GET['client_id'] ?? null;

if ($method === 'GET' && $clientId) {
    assert_can_access_client($user, $clientId);
    $stmt = db()->prepare('SELECT * FROM claims WHERE client_id = ? ORDER BY notified_at DESC');
    $stmt->execute([$clientId]);
    json_out($stmt->fetchAll());
}

if ($method === 'GET') {
    // ClaimsQueuePage.tsx — admin/staff only (associates were select-only
    // and always scoped by client under the old RLS, never given this
    // unscoped "every claim" view).
    require_role('admin', 'staff');
    $rows = db()->query(
        'SELECT cl.*, c.full_name AS client_full_name, c.phone AS client_phone
         FROM claims cl JOIN clients c ON c.id = cl.client_id
         ORDER BY cl.notified_at DESC'
    )->fetchAll();
    json_out(array_map(function (array $row): array {
        $row['clients'] = ['full_name' => $row['client_full_name'], 'phone' => $row['client_phone']];
        unset($row['client_full_name'], $row['client_phone']);
        return $row;
    }, $rows));
}

if ($method === 'POST') {
    require_role('admin', 'staff');
    $body = json_input();
    if (empty($body['client_id'])) json_error('client_id is required', 422);

    $newId = uuid4();
    db()->prepare('INSERT INTO claims (id, client_id, policy_id, notes) VALUES (?, ?, ?, ?)')
        ->execute([$newId, $body['client_id'], $body['policy_id'] ?? null, $body['notes'] ?? null]);
    log_audit('claims', $newId, 'insert', null, ['id' => $newId, 'client_id' => $body['client_id'], 'policy_id' => $body['policy_id'] ?? null, 'notes' => $body['notes'] ?? null]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    require_role('admin', 'staff');
    $stmt = db()->prepare('SELECT * FROM claims WHERE id = ?');
    $stmt->execute([$id]);
    $old = $stmt->fetch();
    if (!$old) json_error('Not found', 404);

    $body = json_input();
    if (!array_key_exists('stage', $body)) json_error('stage is required', 422);
    db()->prepare('UPDATE claims SET stage = ?, settled_at = ? WHERE id = ?')
        ->execute([$body['stage'], $body['settled_at'] ?? null, $id]);

    $stmt = db()->prepare('SELECT * FROM claims WHERE id = ?');
    $stmt->execute([$id]);
    log_audit('claims', $id, 'update', $old, $stmt->fetch());
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
