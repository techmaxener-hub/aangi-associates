<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/pdf_write.php';
require __DIR__ . '/lib/zip_writer.php';

// The "Download All" button on a client's detail page. Two modes:
//   ?mode=zip (default) — one full policy_summary PDF per policy this
//                          client holds, zipped into a single download
//                          (lib/zip_writer.php — hand-rolled, stored/
//                          uncompressed, see that file's header for why).
//   ?mode=digest         — instead, ONE page summarizing every policy at
//                          once (pdf_write_household_digest()), for
//                          someone who wants an overview, not N PDFs.
// Admin/staff/owning-associate only, same scoping as every other
// client-policy endpoint (assert_can_access_client).

$user = require_login();
if ($user['role'] === 'client') json_error('Forbidden', 403);

$clientId = $_GET['client_id'] ?? null;
if (!$clientId) json_error('client_id is required', 422);
assert_can_access_client($user, $clientId);

$stmt = db()->prepare('SELECT full_name, phone FROM clients WHERE id = ?');
$stmt->execute([$clientId]);
$clientRow = $stmt->fetch();
if (!$clientRow) json_error('Not found', 404);

$stmt = db()->prepare(
    'SELECT cp.*, u.full_name AS advisor_name, u.phone AS advisor_phone
     FROM client_policies cp
     JOIN clients c ON c.id = cp.client_id
     LEFT JOIN users u ON u.id = c.owner_id
     WHERE cp.client_id = ?
     ORDER BY cp.created_at DESC'
);
$stmt->execute([$clientId]);
$policies = $stmt->fetchAll();
if (!$policies) json_error('This client has no policies to export', 422);

$client = ['full_name' => $clientRow['full_name']];
$mode = $_GET['mode'] ?? 'zip';
$safeClientName = preg_replace('/\s+/', '-', (string) $clientRow['full_name']);

if ($mode === 'digest') {
    $advisorName = $policies[0]['advisor_name'] ?: 'Jainik Shah';
    $digestPolicies = array_map(fn ($p) => [
        'policy_number' => $p['policy_number'],
        'insurer' => $p['insurer'],
        'product_type' => $p['product_type'],
        'sum_assured' => $p['sum_assured'] !== null ? (float) $p['sum_assured'] : null,
        'premium' => $p['premium'] !== null ? (float) $p['premium'] : null,
        'renewal_date' => $p['renewal_date'],
    ], $policies);
    $pdf = pdf_write_household_digest($client, $digestPolicies, $advisorName);
    $filename = "Aangi-Household-Digest-$safeClientName.pdf";
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', $filename) . '"');
    header('Content-Length: ' . (string) strlen($pdf));
    echo $pdf;
    exit;
}

if ($mode !== 'zip') json_error('Unknown mode', 422);

$files = [];
foreach ($policies as $p) {
    $policy = [
        'id' => $p['id'],
        'policy_number' => $p['policy_number'],
        'insurer' => $p['insurer'],
        'product_type' => $p['product_type'],
        'sum_assured' => $p['sum_assured'] !== null ? (float) $p['sum_assured'] : null,
        'premium' => $p['premium'] !== null ? (float) $p['premium'] : null,
        'start_date' => $p['start_date'],
        'renewal_date' => $p['renewal_date'],
        'nominee_name' => $p['nominee_name'] ?? null,
        'nominee_relation' => $p['nominee_relation'] ?? null,
    ];
    $advisorName = $p['advisor_name'] ?: 'Jainik Shah';
    $advisorPhone = $p['advisor_phone'] ?: null;
    $pdf = pdf_write_policy_summary($client, $policy, $advisorName, $advisorPhone);
    $safeProduct = preg_replace('/\s+/', '-', trim((string) preg_replace('/[^A-Za-z0-9 ]/', '', $p['product_type'])));
    $entryName = ($safeProduct !== '' ? $safeProduct : 'Policy') . '-' . substr((string) $p['id'], 0, 8) . '.pdf';
    $files[$entryName] = $pdf;
}
$zip = zip_build($files);
$zipName = "Aangi-All-Policies-$safeClientName.zip";
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . str_replace('"', '', $zipName) . '"');
header('Content-Length: ' . (string) strlen($zip));
echo $zip;
