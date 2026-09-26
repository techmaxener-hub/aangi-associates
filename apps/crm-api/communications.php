<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors ClientDetailPage.tsx's CommunicationsTab (list by client, log).
// RLS this replaces (0004_crm_core.sql): admin/staff full CRUD; associate
// FULL CRUD (unlike claims/client_policies) scoped via clients.owner_id;
// client role gets none. Never one of the 4 audited tables.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$clientId = $_GET['client_id'] ?? null;
$id = $_GET['id'] ?? null;

if ($method === 'GET' && $clientId) {
    assert_can_access_client($user, $clientId);
    $stmt = db()->prepare('SELECT * FROM communications WHERE client_id = ? ORDER BY occurred_at DESC');
    $stmt->execute([$clientId]);
    json_out($stmt->fetchAll());
}

// Bulk "last contact per client" for ClientsListPage.tsx's "Days since
// last contact" column — one aggregate query instead of an N+1 GET-per-
// client, scoped the same way assert_can_access_client() scopes a single
// client (associate: only their own; client role: none, same as above).
if ($method === 'GET' && ($_GET['last_per_client'] ?? null)) {
    if ($user['role'] === 'client') json_error('Forbidden', 403);
    if ($user['role'] === 'associate') {
        $ids = owned_client_ids($user['id']);
        if (!$ids) json_out([]);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = db()->prepare(
            "SELECT client_id, MAX(occurred_at) AS last_contact FROM communications
             WHERE client_id IN ($placeholders) GROUP BY client_id"
        );
        $stmt->execute($ids);
    } else {
        $stmt = db()->query('SELECT client_id, MAX(occurred_at) AS last_contact FROM communications GROUP BY client_id');
    }
    json_out($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_input();
    if (empty($body['client_id']) || empty($body['channel'])) json_error('client_id and channel are required', 422);
    assert_can_access_client($user, $body['client_id']);
    if ($user['role'] === 'client') json_error('Forbidden', 403);

    $newId = uuid4();
    db()->prepare('INSERT INTO communications (id, client_id, channel, notes, logged_by) VALUES (?, ?, ?, ?, ?)')
        ->execute([$newId, $body['client_id'], $body['channel'], $body['notes'] ?? null, $user['id']]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    $stmt = db()->prepare('SELECT client_id FROM communications WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Not found', 404);
    assert_can_access_client($user, $row['client_id']);
    if ($user['role'] === 'client') json_error('Forbidden', 403);

    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['channel', 'notes'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    $params[] = $id;
    db()->prepare('UPDATE communications SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
