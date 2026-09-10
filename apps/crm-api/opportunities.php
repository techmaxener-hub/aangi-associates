<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/audit.php';

// Mirrors ClientDetailPage.tsx's PipelineTab (list by client, create,
// advance stage). RLS this replaces (0004_crm_core.sql): admin/staff full
// CRUD; associate FULL CRUD (not just select) but ONLY where owner_id =
// self — owner_id lives directly on this table, unlike client_policies/
// claims/communications which scope via a join to clients.owner_id. One
// of the 4 audited tables.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$clientId = $_GET['client_id'] ?? null;

function assert_owns_opportunity(array $user, array $row): void
{
    if (is_back_office($user)) return;
    if ($user['role'] === 'associate' && $row['owner_id'] === $user['id']) return;
    json_error('Forbidden', 403);
}

if ($method === 'GET' && $clientId) {
    assert_can_access_client($user, $clientId);
    $stmt = db()->prepare('SELECT * FROM opportunities WHERE client_id = ? ORDER BY created_at DESC');
    $stmt->execute([$clientId]);
    json_out($stmt->fetchAll());
}

if ($method === 'POST') {
    if (!is_back_office($user) && $user['role'] !== 'associate') json_error('Forbidden', 403);
    $body = json_input();
    if (empty($body['client_id']) || empty($body['product_type'])) json_error('client_id and product_type are required', 422);
    assert_can_access_client($user, $body['client_id']);

    $ownerId = $user['role'] === 'associate' ? $user['id'] : ($body['owner_id'] ?? null);
    $newId = uuid4();
    db()->prepare('INSERT INTO opportunities (id, client_id, product_type, owner_id) VALUES (?, ?, ?, ?)')
        ->execute([$newId, $body['client_id'], $body['product_type'], $ownerId]);
    log_audit('opportunities', $newId, 'insert', null, ['id' => $newId, 'client_id' => $body['client_id'], 'product_type' => $body['product_type'], 'owner_id' => $ownerId]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    $stmt = db()->prepare('SELECT * FROM opportunities WHERE id = ?');
    $stmt->execute([$id]);
    $old = $stmt->fetch();
    if (!$old) json_error('Not found', 404);
    assert_owns_opportunity($user, $old);

    $body = json_input();
    if (!array_key_exists('stage', $body)) json_error('stage is required', 422);
    db()->prepare('UPDATE opportunities SET stage = ? WHERE id = ?')->execute([$body['stage'], $id]);

    $stmt = db()->prepare('SELECT * FROM opportunities WHERE id = ?');
    $stmt->execute([$id]);
    log_audit('opportunities', $id, 'update', $old, $stmt->fetch());
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
