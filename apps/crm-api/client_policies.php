<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/audit.php';

// Mirrors ClientDetailPage.tsx's PoliciesTab (list by client, create),
// useMyClient.ts (client-portal self read), AdminDashboard.tsx and
// NotificationStrip.tsx (unfiltered list — admin/staff full access is
// itself the old RLS behavior, so no extra filter needed for those).
//
// RLS this replaces (0004_crm_core.sql): admin/staff full CRUD; associate
// select-only via clients.owner_id; client select-only via
// clients.portal_user_id. One of the 4 tables the old log_audit() trigger
// covered — logged explicitly here on create/update.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$clientId = $_GET['client_id'] ?? null;

if ($method === 'GET' && $id) {
    $stmt = db()->prepare('SELECT * FROM client_policies WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Not found', 404);
    assert_can_access_client($user, $row['client_id']);
    json_out($row);
}

if ($method === 'GET' && $clientId) {
    assert_can_access_client($user, $clientId);
    $stmt = db()->prepare('SELECT * FROM client_policies WHERE client_id = ? ORDER BY created_at DESC');
    $stmt->execute([$clientId]);
    json_out($stmt->fetchAll());
}

if ($method === 'GET') {
    // AdminDashboard.tsx / NotificationStrip.tsx — unfiltered, admin/staff
    // only (associates never listed all policies this way under the old RLS).
    require_role('admin', 'staff');
    json_out(db()->query('SELECT id, product_type, renewal_date, status FROM client_policies')->fetchAll());
}

if ($method === 'POST') {
    require_role('admin', 'staff');
    $body = json_input();
    if (empty($body['client_id']) || empty($body['product_type'])) json_error('client_id and product_type are required', 422);

    $newId = uuid4();
    $data = [
        'client_id' => $body['client_id'],
        'policy_number' => $body['policy_number'] ?? null,
        'insurer' => $body['insurer'] ?? 'TATA AIA',
        'product_type' => $body['product_type'],
        'sum_assured' => $body['sum_assured'] ?? null,
        'premium' => $body['premium'] ?? null,
        'start_date' => $body['start_date'] ?? null,
        'renewal_date' => $body['renewal_date'] ?? null,
        'category_id' => $body['category_id'] ?? null,
    ];
    $stmt = db()->prepare(
        'INSERT INTO client_policies (id, client_id, policy_number, insurer, product_type, sum_assured, premium, start_date, renewal_date, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$newId, $data['client_id'], $data['policy_number'], $data['insurer'], $data['product_type'], $data['sum_assured'], $data['premium'], $data['start_date'], $data['renewal_date'], $data['category_id']]);
    log_audit('client_policies', $newId, 'insert', null, $data + ['id' => $newId]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    require_role('admin', 'staff');
    $stmt = db()->prepare('SELECT * FROM client_policies WHERE id = ?');
    $stmt->execute([$id]);
    $old = $stmt->fetch();
    if (!$old) json_error('Not found', 404);

    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['policy_number', 'insurer', 'product_type', 'sum_assured', 'premium', 'start_date', 'renewal_date', 'status', 'category_id'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    $params[] = $id;
    db()->prepare('UPDATE client_policies SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

    $stmt = db()->prepare('SELECT * FROM client_policies WHERE id = ?');
    $stmt->execute([$id]);
    log_audit('client_policies', $id, 'update', $old, $stmt->fetch());
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
