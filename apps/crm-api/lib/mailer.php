<?php
declare(strict_types=1);

// Business Planning's "Send Email" action. Unlike lib/sms.php's WhatsApp/
// SMS dispatch, this needs no third-party account — PHP's mail() hands off
// to the host's own mail transport, which Hostinger shared hosting
// provides for domains it hosts. Still returns the real outcome (mail()'s
// actual boolean) rather than assuming success — deliverability without
// SPF/DKIM on this subdomain isn't guaranteed, and the caller (
// business_plan_send.php) logs whatever actually happened to
// business_plan_sends.
function send_branded_email(string $toEmail, string $toName, string $subject, string $htmlBody): bool
{
    $from = defined('MAIL_FROM_ADDRESS') && MAIL_FROM_ADDRESS !== '' ? MAIL_FROM_ADDRESS : 'no-reply@localhost';
    $fromName = defined('MAIL_FROM_NAME') && MAIL_FROM_NAME !== '' ? MAIL_FROM_NAME : 'Aangi Associates';

    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        sprintf('From: %s <%s>', encode_header_word($fromName), $from),
        sprintf('Reply-To: %s', $from),
        'X-Mailer: Aangi CRM',
    ]);

    return @mail($toEmail, encode_header_word($subject), $htmlBody, $headers);
}

// mail()'s subject/From-name headers need RFC 2047 encoding once they
// contain anything outside ASCII (not expected here today, but associate
// names are user-entered free text — cheap to be safe).
function encode_header_word(string $text): string
{
    return preg_match('/[^\x20-\x7E]/', $text) ? '=?UTF-8?B?' . base64_encode($text) . '?=' : $text;
}

// Same no-third-party-account approach as send_branded_email() above, just
// with one PDF attachment — used only by cron/daily_intimation.php. PHP's
// mail() has no built-in attachment support, so this builds the
// multipart/mixed body by hand: one text/html part, one application/pdf
// part, base64-encoded, joined by a random boundary string.
function send_email_with_pdf_attachment(string $toEmail, string $toName, string $subject, string $htmlBody, string $pdfBytes, string $pdfFilename): bool
{
    $from = defined('MAIL_FROM_ADDRESS') && MAIL_FROM_ADDRESS !== '' ? MAIL_FROM_ADDRESS : 'no-reply@localhost';
    $fromName = defined('MAIL_FROM_NAME') && MAIL_FROM_NAME !== '' ? MAIL_FROM_NAME : 'Aangi Associates';
    $boundary = 'aangi-' . bin2hex(random_bytes(16));

    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        "Content-Type: multipart/mixed; boundary=\"$boundary\"",
        sprintf('From: %s <%s>', encode_header_word($fromName), $from),
        sprintf('Reply-To: %s', $from),
        'X-Mailer: Aangi CRM',
    ]);

    $body = "--$boundary\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $htmlBody . "\r\n\r\n"
        . "--$boundary\r\n"
        . "Content-Type: application/pdf; name=\"$pdfFilename\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"$pdfFilename\"\r\n\r\n"
        . chunk_split(base64_encode($pdfBytes)) . "\r\n"
        . "--$boundary--";

    return @mail($toEmail, encode_header_word($subject), $body, $headers);
}

// Shared branded HTML shell for the plan email — a plain, email-client-safe
// table layout (no external CSS/webfonts) using the locked brand colors
// from packages/ui/tokens.css.
function render_plan_email_html(array $plan): string
{
    $navy = '#0f2a4a';
    $gold = '#8f6f26';

    $rows = '';
    foreach ($plan['targets'] as $t) {
        $expected = $t['expected_premium'] !== null ? '₹' . number_format((float) $t['expected_premium']) : '—';
        $achieved = '₹' . number_format((float) $t['achieved_premium']);
        $pct = $t['expected_premium'] > 0 ? round($t['achieved_premium'] / $t['expected_premium'] * 100) : 0;
        $rows .= "<tr>
            <td style=\"padding:8px 10px;border-bottom:1px solid #e1d9c3;\">{$t['category_name']}</td>
            <td style=\"padding:8px 10px;border-bottom:1px solid #e1d9c3;text-align:right;\">$expected</td>
            <td style=\"padding:8px 10px;border-bottom:1px solid #e1d9c3;text-align:right;\">$achieved</td>
            <td style=\"padding:8px 10px;border-bottom:1px solid #e1d9c3;text-align:right;\">{$pct}%</td>
        </tr>";
    }

    $notes = !empty($plan['notes']) ? '<p style="margin:16px 0 0;color:#5b6272;font-size:13px;">' . nl2br(htmlspecialchars($plan['notes'])) . '</p>' : '';

    return "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;\">
        <div style=\"background:$navy;padding:20px 24px;\">
            <p style=\"margin:0;color:#f6f3ea;font-size:18px;font-weight:bold;\">Aangi Associates</p>
            <p style=\"margin:2px 0 0;color:#f6f3ea;opacity:.75;font-size:12px;\">Business Plan — {$plan['period_label']}</p>
        </div>
        <div style=\"height:4px;background:$gold;\"></div>
        <div style=\"padding:20px 24px;\">
            <p style=\"margin:0 0 12px;color:#1b2333;font-size:14px;\">Hi {$plan['associate_name']}, here is your business plan for <strong>{$plan['period_label']}</strong>.</p>
            <table style=\"width:100%;border-collapse:collapse;font-size:13px;color:#1b2333;\">
                <thead>
                    <tr style=\"background:#efe8d8;\">
                        <th style=\"padding:8px 10px;text-align:left;\">Category</th>
                        <th style=\"padding:8px 10px;text-align:right;\">Target</th>
                        <th style=\"padding:8px 10px;text-align:right;\">Achieved</th>
                        <th style=\"padding:8px 10px;text-align:right;\">%</th>
                    </tr>
                </thead>
                <tbody>$rows</tbody>
            </table>
            $notes
        </div>
        <div style=\"padding:14px 24px;background:#f7f4ee;border-top:1px solid #e1d9c3;\">
            <p style=\"margin:0;color:#5b6272;font-size:11px;\">This is an internal planning summary from Aangi Associates' CRM — not a policy document.</p>
        </div>
    </div>";
}
