<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors CandidatesPage.tsx (list, create, advance), CandidateDetailPage.tsx
// (single read, stage/notes update), TasksPage.tsx's picker (?picker=1),
// GlobalSearch.tsx (?search=). RLS this replaces (0004_crm_core.sql):
// admin/staff only — no associate or client policy existed at all.

$user = require_role('admin', 'staff');
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET' && $id) {
    $stmt = db()->prepare('SELECT * FROM candidates WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Not found', 404);
    json_out($row);
}

if ($method === 'GET') {
    $where = [];
    $params = [];
    if (!empty($_GET['search'])) {
        $where[] = '(full_name LIKE ? OR phone LIKE ?)';
        $like = '%' . $_GET['search'] . '%';
        $params[] = $like;
        $params[] = $like;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $cols = !empty($_GET['picker']) ? 'id, full_name' : '*';
    $order = !empty($_GET['picker']) ? 'full_name' : 'created_at DESC';
    $stmt = db()->prepare("SELECT $cols FROM candidates $whereSql ORDER BY $order");
    $stmt->execute($params);
    json_out($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_input();
    foreach (['full_name', 'phone', 'track'] as $required) {
        if (empty($body[$required])) json_error("$required is required", 422);
    }
    $newId = uuid4();
    $stmt = db()->prepare(
        'INSERT INTO candidates (id, full_name, phone, email, city, occupation, track, stage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $newId,
        $body['full_name'],
        $body['phone'],
        $body['email'] ?? null,
        $body['city'] ?? null,
        $body['occupation'] ?? null,
        $body['track'],
        $body['stage'] ?? 'application',
    ]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['stage', 'notes'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    $params[] = $id;
    db()->prepare('UPDATE candidates SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
