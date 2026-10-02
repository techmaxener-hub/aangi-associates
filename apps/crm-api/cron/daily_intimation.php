<?php
declare(strict_types=1);

// Run daily by a Hostinger hPanel Cron Job (same mechanism as
// cron/renewal_reminders.php — see ../README.md). Builds today's
// Admin/Staff intimation digest (due birthday wishes + renewal reminders)
// and emails it to every admin/staff user with an email on file, as both
// an HTML list (buttons work natively in an email client) and a PDF
// attachment (lib/pdf_write.php — has its own real clickable Link
// annotations, for printing or offline review). Neither ever contacts a
// client directly: every button/link here is the admin/staff member's own
// dispatch_token redirect (intimation_redirect.php), which only fires when
// THEY click it.

require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/intimation.php';
require __DIR__ . '/../lib/pdf_write.php';
require __DIR__ . '/../lib/mailer.php';

$today = gmdate('Y-m-d');
$items = intimation_due_items($today);

if (!$items) {
    echo "[" . gmdate('Y-m-d H:i:s') . "] daily_intimation: no items due for $today, nothing sent\n";
    exit;
}

$recipients = db()->query("SELECT email, full_name FROM users WHERE role IN ('admin','staff') AND email IS NOT NULL AND email != ''")->fetchAll();
if (!$recipients) {
    echo "[" . gmdate('Y-m-d H:i:s') . "] daily_intimation: $today has " . count($items) . " item(s) but no admin/staff email on file to send to\n";
    exit;
}

function daily_intimation_render_html(array $items, string $date): string
{
    $rows = '';
    foreach ($items as $item) {
        $label = $item['kind'] === 'birthday' ? 'Birthday' : 'Renewal';
        $detail = $item['kind'] === 'birthday'
            ? 'Today is their birthday.'
            : trim(($item['product_type'] ?? 'Policy') . ' — due ' . ($item['renewal_date'] ? date('d M Y', strtotime($item['renewal_date'])) : '—'));
        $rows .= '<tr>'
            . '<td style="padding:8px 10px;border-bottom:1px solid #e1d9c3;"><strong>' . htmlspecialchars($label) . '</strong><br>' . htmlspecialchars($item['client_name']) . '</td>'
            . '<td style="padding:8px 10px;border-bottom:1px solid #e1d9c3;">' . htmlspecialchars($detail) . '</td>'
            . '<td style="padding:8px 10px;border-bottom:1px solid #e1d9c3;text-align:right;">'
            . '<a href="' . htmlspecialchars($item['redirect_link']) . '" style="display:inline-block;padding:6px 12px;background:#8f6f26;color:#f6f3ea;border-radius:4px;text-decoration:none;font-size:12px;">Send via WhatsApp</a>'
            . '</td></tr>';
    }

    return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;">'
        . '<div style="background:#0f2a4a;padding:20px 24px;">'
        . '<p style="margin:0;color:#f6f3ea;font-size:18px;font-weight:bold;">Aangi Associates</p>'
        . '<p style="margin:2px 0 0;color:#f6f3ea;opacity:.75;font-size:12px;">Daily Intimation Digest — ' . htmlspecialchars($date) . '</p>'
        . '</div><div style="height:4px;background:#8f6f26;"></div>'
        . '<div style="padding:20px 24px;">'
        . '<p style="margin:0 0 12px;color:#1b2333;font-size:13px;">' . count($items) . ' item(s) due today. Review each and press "Send via WhatsApp" to open a pre-filled chat with that client — nothing is sent until you do.</p>'
        . '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#1b2333;">'
        . '<thead><tr style="background:#efe8d8;"><th style="padding:8px 10px;text-align:left;">Who</th><th style="padding:8px 10px;text-align:left;">What</th><th style="padding:8px 10px;"></th></tr></thead>'
        . '<tbody>' . $rows . '</tbody></table>'
        . '<p style="margin:16px 0 0;color:#5b6272;font-size:11px;">A PDF copy of this list (with the same buttons) is attached. The full, always-current list is also in the CRM under Intimations.</p>'
        . '</div></div>';
}

$pdf = pdf_write_intimation_digest($today, $items);
$html = daily_intimation_render_html($items, $today);
$subject = 'Aangi Associates — Intimation Digest for ' . $today . ' (' . count($items) . ' item' . (count($items) === 1 ? '' : 's') . ')';

$sent = 0;
$failed = 0;
foreach ($recipients as $r) {
    $ok = send_email_with_pdf_attachment($r['email'], $r['full_name'] ?? '', $subject, $html, $pdf, "intimation-digest-$today.pdf");
    if ($ok) $sent++; else $failed++;
}

echo sprintf(
    "[%s] daily_intimation: %s has %d item(s) — emailed %d recipient(s), %d failed\n",
    gmdate('Y-m-d H:i:s'),
    $today,
    count($items),
    $sent,
    $failed
);
