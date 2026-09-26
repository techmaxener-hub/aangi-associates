<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/audit.php';
require __DIR__ . '/lib/business_plan_data.php';

// Business Planning: admin sets per-category targets (expected achievement
// + commission) for an associate over a period; actual achievement is
// computed live by fetch_plan()/fetch_consolidated() (lib/business_plan_data.php)
// from client_policies — never stored here.
//
// Access shape: admin full CRUD; associate read-only, auto-scoped to their
// own plans (same associate_scope_id() shape tasks.php/leads.php use for
// assigned_to). Staff isn't part of this feature per the spec.

$user = require_login();
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET' && !empty($_GET['consolidated'])) {
    require_role('admin');
    json_out(fetch_consolidated($_GET['start_date'] ?? null, $_GET['end_date'] ?? null));
}

if ($method === 'GET' && $id) {
    $plan = fetch_plan($id);
    if (!$plan) json_error('Not found', 404);
    assert_can_view_plan($user, $plan);
    json_out($plan);
}

if ($method === 'GET') {
    $where = [];
    $params = [];
    $scopeId = associate_scope_id($user);
    if ($scopeId) {
        $where[] = 'bp.associate_id = ?';
        $params[] = $scopeId;
    } elseif (!empty($_GET['associate_id'])) {
        $where[] = 'bp.associate_id = ?';
        $params[] = $_GET['associate_id'];
    }
    if (!empty($_GET['period_type'])) {
        $where[] = 'bp.period_type = ?';
        $params[] = $_GET['period_type'];
    }
    // "Plans overlapping this window" — lets the period-picker filter show
    // e.g. every plan touching October even if a plan's own dates don't
    // exactly match the filter's month boundaries.
    if (!empty($_GET['start_date']) && !empty($_GET['end_date'])) {
        $where[] = 'bp.start_date <= ? AND bp.end_date >= ?';
        $params[] = $_GET['end_date'];
        $params[] = $_GET['start_date'];
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $stmt = db()->prepare(
        "SELECT bp.id FROM business_plans bp $whereSql ORDER BY bp.start_date DESC, bp.created_at DESC"
    );
    $stmt->execute($params);
    $ids = array_column($stmt->fetchAll(), 'id');
    json_out(array_map('fetch_plan', $ids));
}

if ($method === 'POST') {
    require_role('admin');
    $body = json_input();
    json_out(create_or_replace_plan($user, $body), 201);
}

if ($method === 'PUT' && $id && ($_GET['action'] ?? null) === 'view') {
    $plan = fetch_plan($id);
    if (!$plan) json_error('Not found', 404);
    assert_can_view_plan($user, $plan);
    db()->prepare('UPDATE business_plans SET viewed_at = COALESCE(viewed_at, UTC_TIMESTAMP()) WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

if ($method === 'PUT' && $id) {
    require_role('admin');
    $stmt = db()->prepare('SELECT * FROM business_plans WHERE id = ?');
    $stmt->execute([$id]);
    $old = $stmt->fetch();
    if (!$old) json_error('Not found', 404);

    $body = json_input();
    json_out(create_or_replace_plan($user, $body, $id, $old));
}

if ($method === 'DELETE' && $id) {
    require_role('admin');
    $stmt = db()->prepare('SELECT * FROM business_plans WHERE id = ?');
    $stmt->execute([$id]);
    $old = $stmt->fetch();
    if (!$old) json_error('Not found', 404);
    db()->prepare('DELETE FROM business_plans WHERE id = ?')->execute([$id]);
    log_audit('business_plans', $id, 'delete', $old, null);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
