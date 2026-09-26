<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/pivot_data.php';

// Mirrors modules/analytics/PivotExplorerPage.tsx. Read-only and admin-only,
// like dashboard.php: it can group every policy and lead in the book.
//
//   GET pivot.php?meta=1                                   dimension/measure catalog
//   GET pivot.php?fact=&rows=&cols=&filters={"dim":["v"]}  the pivot
//   GET pivot.php?fact=&values=DIM                         distinct values for filters
//   GET pivot.php?fact=&records=1&filters=...              drill-through records

require_role('admin');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

if (isset($_GET['meta'])) json_out(pivot_meta());

$fact = (string) ($_GET['fact'] ?? 'policies');
$filters = json_decode((string) ($_GET['filters'] ?? '{}'), true);
if (!is_array($filters)) json_error('filters must be a JSON object', 422);

if (isset($_GET['values'])) json_out(pivot_values(db(), $fact, (string) $_GET['values']));
if (isset($_GET['records'])) json_out(pivot_records(db(), $fact, $filters));

json_out(pivot_run(db(), $fact, (string) ($_GET['rows'] ?? ''), isset($_GET['cols']) ? (string) $_GET['cols'] : null, $filters));
