<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/dashboard_data.php';

// Mirrors portals/admin/AdminDashboard.tsx. Read-only, admin only: it
// aggregates every lead, client, policy, claim and task, which is exactly the
// unscoped view only Admin has (associates/staff/clients never had it).

require_role('admin');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

// "Today" for a business in Ahmedabad is the IST calendar date, not UTC.
$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kolkata'));
json_out(dashboard_stats(db(), $today));
