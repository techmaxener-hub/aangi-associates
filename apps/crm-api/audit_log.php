<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';

// Mirrors AuditLogPage.tsx. RLS this replaces (0011_audit_log.sql):
// admin-only select; rows are written exclusively by lib/audit.php calls
// inside users/client_policies/opportunities/claims (there's no MySQL
// trigger equivalent to the original log_audit() — see that file's header).

require_role('admin');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$rows = db()->query(
    'SELECT al.*, u.full_name AS actor_full_name
     FROM audit_log al LEFT JOIN users u ON u.id = al.changed_by
     ORDER BY al.changed_at DESC LIMIT 200'
)->fetchAll();

json_out(array_map(function (array $row): array {
    $row['old_data'] = $row['old_data'] ? json_decode($row['old_data'], true) : null;
    $row['new_data'] = $row['new_data'] ? json_decode($row['new_data'], true) : null;
    $row['actor'] = $row['actor_full_name'] ? ['full_name' => $row['actor_full_name']] : null;
    unset($row['actor_full_name']);
    return $row;
}, $rows));
