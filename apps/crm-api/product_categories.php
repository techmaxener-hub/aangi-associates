<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Business Planning's product-line taxonomy (Life/General/Health Insurance,
// Mutual Funds, seeded in seed.sql, plus whatever admin adds). Read by
// anyone authenticated (client_policies' category dropdown, associates
// viewing their own plan); writes are admin-only.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM product_categories WHERE is_active = 1 ORDER BY sort_order, name');
    json_out($stmt->fetchAll());
}

if ($method === 'POST') {
    require_role('admin');
    $body = json_input();
    if (empty($body['name'])) json_error('name is required', 422);

    $newId = uuid4();
    $stmt = db()->prepare(
        'INSERT INTO product_categories (id, name, sort_order) VALUES (?, ?, ?)'
    );
    try {
        $stmt->execute([$newId, trim($body['name']), (int) ($body['sort_order'] ?? 99)]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') json_error('A category with this name already exists', 409);
        throw $e;
    }
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    require_role('admin');
    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['name', 'sort_order', 'is_active'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    $params[] = $id;
    db()->prepare('UPDATE product_categories SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['ok' => true]);
}

if ($method === 'DELETE' && $id) {
    require_role('admin');
    // Soft-delete only — category_id is referenced by client_policies and
    // business_plan_targets, and hiding rather than removing means past
    // plans/policies keep their label instead of turning into orphans.
    db()->prepare('UPDATE product_categories SET is_active = 0 WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
