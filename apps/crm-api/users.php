<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';

// Mirrors the `profiles` picker queries in TasksPage.tsx and
// LeadsDeskPage.tsx (`select("id, full_name, role").in("role", [...])`),
// which the old `profiles_select_staff`/`profiles_select_admin` RLS
// policies allowed for admin/staff. Read-only, admin/staff only — never
// exposes password_hash/email/phone to the picker.

$user = require_role('admin', 'staff');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$stmt = db()->query(
    "SELECT id, full_name, role FROM users WHERE role IN ('admin','staff','associate') ORDER BY full_name"
);
json_out($stmt->fetchAll());
