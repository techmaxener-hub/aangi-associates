<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/intimation.php';

// Public, no-login endpoint — the whole point of a dispatch_token is that
// it has to work from a static PDF or an email, where there's no browser
// session to check. Marks the item "clicked" (an admin/staff member
// actually acted on it — never that the client received anything, since
// nothing is sent until the human presses "Send" in their own WhatsApp
// after landing there) then redirects straight to the pre-filled wa.me
// chat. A GET, not a POST, on purpose: this link has to work as a plain
// clickable PDF/email hyperlink.

$token = $_GET['token'] ?? '';
if (!is_string($token) || !preg_match('/^[a-f0-9]{32}$/', $token)) {
    http_response_code(400);
    header('Content-Type: text/plain');
    echo 'Invalid link.';
    exit;
}

$stmt = db()->prepare(
    'SELECT ii.id, ii.kind, ii.clicked_at, ii.scheduled_for, c.full_name, c.phone, cp.product_type, cp.renewal_date
     FROM intimation_items ii
     JOIN clients c ON c.id = ii.client_id
     LEFT JOIN client_policies cp ON cp.id = ii.policy_id
     WHERE ii.dispatch_token = ?'
);
$stmt->execute([$token]);
$row = $stmt->fetch();
if (!$row) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo 'This link has expired or is no longer valid.';
    exit;
}

if (!$row['clicked_at']) {
    db()->prepare('UPDATE intimation_items SET clicked_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$row['id']]);
}

$message = intimation_build_message($row['kind'], $row['full_name'], $row['product_type'], $row['renewal_date'], $row['scheduled_for']);
header('Location: ' . intimation_wa_link($row['phone'], $message));
exit;
