<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/retention_data.php';

// Mirrors modules/retention/RetentionPage.tsx. Read-only, admin-only (it spans
// every client's policies and contact history).

require_role('admin');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kolkata'));
json_out(retention_stats(db(), $today));
