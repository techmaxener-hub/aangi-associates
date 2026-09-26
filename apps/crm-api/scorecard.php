<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/scorecard_data.php';

// Mirrors modules/scorecard/ScorecardPage.tsx. Read-only and admin-only:
// it compares every associate's leads, clients, tasks and plan progress.

require_role('admin');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kolkata'));
json_out(scorecard_stats(db(), $today));
