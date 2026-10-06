<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/pdf_write.php';
require __DIR__ . '/lib/mailer.php';

// Powers the "My Clients" policy list's Download and Send via Email
// buttons (ClientsListPage.tsx) — one PHP-generated 2-page PDF
// (lib/pdf_write.php's pdf_write_policy_summary()) serves both, so the
// document download gets and the document emailed are always byte-for-
// byte the same, never two slightly-different implementations drifting
// apart. "Send via WhatsApp" has no server endpoint — same wa.me
// click-to-chat pattern used everywhere else in this app, no API needed.

$user = require_login();
if ($user['role'] === 'client') json_error('Forbidden', 403);

$policyId = $_GET['policy_id'] ?? ($_POST['policy_id'] ?? null);
if (!$policyId) json_error('policy_id is required', 422);

$stmt = db()->prepare(
    'SELECT cp.*, c.full_name AS client_name, c.phone AS client_phone, c.email AS client_email,
            u.full_name AS advisor_name, u.phone AS advisor_phone
     FROM client_policies cp
     JOIN clients c ON c.id = cp.client_id
     LEFT JOIN users u ON u.id = c.owner_id
     WHERE cp.id = ?'
);
$stmt->execute([$policyId]);
$row = $stmt->fetch();
if (!$row) json_error('Not found', 404);
assert_can_access_client($user, $row['client_id']);

$client = ['full_name' => $row['client_name']];
$policy = [
    'id' => $row['id'],
    'policy_number' => $row['policy_number'],
    'insurer' => $row['insurer'],
    'product_type' => $row['product_type'],
    'sum_assured' => $row['sum_assured'] !== null ? (float) $row['sum_assured'] : null,
    'premium' => $row['premium'] !== null ? (float) $row['premium'] : null,
    'start_date' => $row['start_date'],
    'renewal_date' => $row['renewal_date'],
    'nominee_name' => $row['nominee_name'] ?? null,
    'nominee_relation' => $row['nominee_relation'] ?? null,
];
$advisorName = $row['advisor_name'] ?: 'Jainik Shah';
$advisorPhone = $row['advisor_phone'] ?: null;

$action = $_GET['action'] ?? 'download';

// Admin/staff downloads stay unencrypted — they're already behind an
// authenticated session, and nobody wants to re-type a password to open
// their own export. Emailing leaves the office's control (the inbox it
// lands in might be shared, forwarded, or intercepted), so that copy is
// locked with the client's own phone number as the open password — they
// already have it memorized, nobody else needs to be told it.
$openPassword = null;
if ($action === 'email') {
    $openPassword = preg_replace('/\D/', '', (string) $row['client_phone']);
    if ($openPassword === '') $openPassword = null; // no digits on file — fall back to unencrypted rather than lock it with an empty password
}

// ?variant=compact — the 1-page "quick share" version (no bio/claims/
// calculators/MDRT content), for WhatsApp sharing rather than email or a
// formal download. Never password-protected itself (it's meant to be
// forwarded freely on WhatsApp, where a password prompt would just be
// friction — the full document is what carries the encryption option).
$variant = $_GET['variant'] ?? 'full';
// ?lang=gu — Romanized-Gujarati labels on the compact variant only (see
// pdf_write.php's PDF_LABELS_GU docblock for exactly what this is and
// isn't: a best-effort Latin-script transliteration, not real Gujarati
// script, which this PDF engine's Helvetica-only font can't render).
$lang = ($_GET['lang'] ?? 'en') === 'gu' ? 'gu' : 'en';
$pdf = $variant === 'compact'
    ? pdf_write_policy_summary_compact($client, $policy, $advisorName, $advisorPhone, $lang)
    : pdf_write_policy_summary($client, $policy, $advisorName, $advisorPhone, $openPassword);
$filenamePrefix = $variant === 'compact' ? 'Aangi-Quick-Summary-' : 'Aangi-Policy-Summary-';
$filename = $filenamePrefix . preg_replace('/\s+/', '-', $row['client_name']) . '-' . preg_replace('/\s+/', '-', $row['product_type']) . '.pdf';

if ($action === 'email') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);
    if (!$row['client_email']) json_error("This client has no email on file", 422);
    $subject = 'Your Policy Summary — ' . $row['product_type'] . ' (' . $row['insurer'] . ')';
    $passwordNote = $openPassword
        ? '<p style="color:#5b6272;font-size:12px;">This PDF is password-protected for your privacy — open it with your registered mobile number (digits only, no spaces or +91).</p>'
        : '';
    $html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;">'
        . '<div style="background:#0f2a4a;padding:18px 22px;"><p style="margin:0;color:#f6f3ea;font-size:17px;font-weight:bold;">Aangi Associates</p></div>'
        . '<div style="height:4px;background:#8f6f26;"></div>'
        . '<div style="padding:18px 22px;font-size:13px;color:#1b2333;">'
        . '<p>Dear ' . htmlspecialchars($row['client_name']) . ',</p>'
        . '<p>Please find attached your policy summary for your <strong>' . htmlspecialchars($row['product_type']) . '</strong> with ' . htmlspecialchars($row['insurer']) . '.</p>'
        . $passwordNote
        . '<p style="color:#5b6272;font-size:12px;">This is a quick-reference summary, not a substitute for your official policy document.</p>'
        . '</div></div>';
    $ok = send_email_with_pdf_attachment($row['client_email'], $row['client_name'], $subject, $html, $pdf, $filename);
    if (!$ok) json_error('Failed to send email — check mail server configuration', 500);
    json_out(['ok' => true, 'sent_to' => $row['client_email']]);
}

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . str_replace('"', '', $filename) . '"');
header('Content-Length: ' . (string) strlen($pdf));
echo $pdf;
