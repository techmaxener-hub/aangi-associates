<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/business_plan_data.php';
require __DIR__ . '/lib/mailer.php';

// "Send Email" action on a plan — admin-only. Sends a branded HTML summary
// (not a PDF attachment; see business_plans.php's header comment / the
// approved plan doc for why) via PHP mail(), and always logs the REAL
// outcome to business_plan_sends — never a fake "sent" on failure, same
// honesty pattern as lib/sms.php's WhatsApp/SMS dispatch.

$user = require_role('admin');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = json_input();
if (empty($body['plan_id'])) json_error('plan_id is required', 422);

$plan = fetch_plan($body['plan_id']);
if (!$plan) json_error('Plan not found', 404);

if (empty($plan['associate_email'])) {
    json_error('This associate has no email address on file — add one to their account before sending.', 422);
}

$html = render_plan_email_html($plan);
$sent = send_branded_email(
    $plan['associate_email'],
    $plan['associate_name'],
    'Your Aangi Associates Business Plan — ' . $plan['period_label'],
    $html
);

db()->prepare(
    'INSERT INTO business_plan_sends (id, plan_id, sent_to, sent_by, status, error_detail) VALUES (?, ?, ?, ?, ?, ?)'
)->execute([
    uuid4(),
    $plan['id'],
    $plan['associate_email'],
    $user['id'],
    $sent ? 'sent' : 'failed',
    $sent ? null : 'mail() returned false — check server mail transport / SPF-DKIM setup for this domain',
]);

if (!$sent) {
    json_error('The email could not be sent — the server\'s mail transport reported failure. You can still download the PDF and send it manually.', 502);
}

json_out(['ok' => true]);
