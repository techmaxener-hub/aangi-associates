<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors: ClientsListPage.tsx (list, create), ClientDetailPage.tsx
// (single-record read — policies/opportunities/claims/communications are
// separate endpoints, each client-scoped the same way via
// assert_can_access_client()), useMyClient.ts (client-portal self read),
// GlobalSearch.tsx (search), the task/lead pickers (id+full_name only).
//
// RLS this replaces (0004_crm_core.sql): admin/staff full CRUD; associate
// select+update only where owner_id = self; client select-only where
// portal_user_id = self. No associate insert, no client insert/update.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET' && $id) {
    assert_can_access_client($user, $id);
    $stmt = db()->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Not found', 404);
    json_out($row);
}

if ($method === 'GET' && $user['role'] === 'client') {
    // Client-portal self-read (useMyClient.ts) — replaces the old
    // `.eq("portal_user_id", session.user.id).maybeSingle()` query. No id
    // is known client-side up front, so this is keyed off the session.
    $cid = portal_client_id($user['id']);
    if (!$cid) json_out(null); // not yet linked — see clients_portal_user_id comment in schema.sql
    $stmt = db()->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$cid]);
    json_out($stmt->fetch());
}

if ($method === 'GET') {
    // ?search=... (GlobalSearch.tsx) or ?picker=1 (id+full_name only, for
    // task-linking) or the full list (ClientsListPage.tsx).
    if (!is_back_office($user) && $user['role'] !== 'associate') json_error('Forbidden', 403);

    $where = [];
    $params = [];
    if ($user['role'] === 'associate') {
        $where[] = 'owner_id = ?';
        $params[] = $user['id'];
    }
    if (!empty($_GET['search'])) {
        $where[] = '(full_name LIKE ? OR phone LIKE ?)';
        $like = '%' . $_GET['search'] . '%';
        $params[] = $like;
        $params[] = $like;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $cols = !empty($_GET['picker']) ? 'id, full_name' : '*';
    $order = !empty($_GET['picker']) ? 'full_name' : 'created_at DESC';
    $stmt = db()->prepare("SELECT $cols FROM clients $whereSql ORDER BY $order");
    $stmt->execute($params);
    json_out($stmt->fetchAll());
}

if ($method === 'POST') {
    // ClientsListPage.tsx create form — admin/staff only, or an associate
    // creating a client owned by themself was never allowed by the old
    // RLS (no associate insert policy) — keep that restriction.
    require_role('admin', 'staff');
    $body = json_input();
    foreach (['full_name', 'phone'] as $required) {
        if (empty($body[$required])) json_error("$required is required", 422);
    }

    $newId = uuid4();
    $stmt = db()->prepare(
        'INSERT INTO clients (id, full_name, phone, email, city, household_name, owner_id, date_of_birth)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $newId,
        $body['full_name'],
        $body['phone'],
        $body['email'] ?? null,
        $body['city'] ?? null,
        $body['household_name'] ?? null,
        $body['owner_id'] ?? null,
        $body['date_of_birth'] ?? null,
    ]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    // Associate can update only a client they own; admin/staff always can.
    if (!is_back_office($user)) {
        if ($user['role'] !== 'associate') json_error('Forbidden', 403);
        $stmt = db()->prepare('SELECT 1 FROM clients WHERE id = ? AND owner_id = ?');
        $stmt->execute([$id, $user['id']]);
        if (!$stmt->fetch()) json_error('Forbidden', 403);
    }
    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['full_name', 'phone', 'email', 'city', 'household_name', 'owner_id', 'date_of_birth'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    $params[] = $id;
    db()->prepare('UPDATE clients SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
