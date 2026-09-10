<?php
declare(strict_types=1);

// Run daily by a Hostinger hPanel Cron Job (see ../README.md step 6) — NOT
// a web-request endpoint, no session/auth here. Ports the logic from
// apps/crm/supabase/migrations/0013_renewal_reminders.sql's
// generate_and_dispatch_renewal_reminders(), which relied on Postgres's
// pg_cron + pg_net (in-database scheduler + outbound HTTP) — MySQL has no
// equivalent of either, so this has to live outside the database as a
// plain PHP script instead.

require __DIR__ . '/../config.php';
require __DIR__ . '/../lib/uuid.php';

function whatsapp_credentials(): ?array
{
    // Prefer integration_settings (kept in sync with the Lead Hub UI); fall
    // back to env.php constants for a cron-only setup with no admin UI use.
    $stmt = db()->prepare("SELECT credentials FROM integration_settings WHERE provider = 'whatsapp' AND status = 'connected'");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row) {
        $creds = json_decode($row['credentials'], true);
        if (!empty($creds['system_token']) && !empty($creds['phone_number_id'])) {
            return ['token' => $creds['system_token'], 'phone_number_id' => $creds['phone_number_id']];
        }
    }
    if (defined('WHATSAPP_SYSTEM_TOKEN') && WHATSAPP_SYSTEM_TOKEN !== '' && defined('WHATSAPP_PHONE_NUMBER_ID') && WHATSAPP_PHONE_NUMBER_ID !== '') {
        return ['token' => WHATSAPP_SYSTEM_TOKEN, 'phone_number_id' => WHATSAPP_PHONE_NUMBER_ID];
    }
    return null;
}

function send_whatsapp(string $token, string $phoneNumberId, string $to, string $message): bool
{
    $ch = curl_init("https://graph.facebook.com/v18.0/$phoneNumberId/messages");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $token", 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'text',
            'text' => ['body' => $message],
        ]),
        CURLOPT_TIMEOUT => 15,
    ]);
    curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) throw new RuntimeException($err);
    return $status >= 200 && $status < 300;
}

$creds = whatsapp_credentials();
$counts = ['sent' => 0, 'skipped' => 0, 'failed' => 0, 'already_logged' => 0];

foreach ([60, 30, 14] as $milestoneDays) {
    $stmt = db()->prepare(
        'SELECT cp.id AS policy_id, cp.client_id, cp.renewal_date, cp.product_type, c.full_name, c.phone
         FROM client_policies cp JOIN clients c ON c.id = cp.client_id
         WHERE cp.status = "active" AND cp.renewal_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)'
    );
    $stmt->execute([$milestoneDays]);

    foreach ($stmt->fetchAll() as $row) {
        $newId = uuid4();
        $insert = db()->prepare(
            'INSERT IGNORE INTO renewal_reminders (id, policy_id, client_id, milestone_days, renewal_date, scheduled_for, status)
             VALUES (?, ?, ?, ?, ?, CURDATE(), "pending")'
        );
        $insert->execute([$newId, $row['policy_id'], $row['client_id'], $milestoneDays, $row['renewal_date']]);

        if ($insert->rowCount() === 0) {
            // Unique (policy_id, milestone_days, renewal_date) already has a
            // row from a prior run this cycle — don't re-send.
            $counts['already_logged']++;
            continue;
        }

        if (!$creds) {
            db()->prepare("UPDATE renewal_reminders SET status = 'skipped_no_credentials' WHERE id = ?")->execute([$newId]);
            $counts['skipped']++;
            continue;
        }

        $message = sprintf(
            'Hi %s, this is a reminder from Aangi Associates: your %s policy is due for renewal on %s (in %d days). Reply here or call us to renew without a break in cover.',
            $row['full_name'],
            $row['product_type'],
            date('d M Y', strtotime($row['renewal_date'])),
            $milestoneDays
        );

        try {
            send_whatsapp($creds['token'], $creds['phone_number_id'], $row['phone'], $message);
            db()->prepare("UPDATE renewal_reminders SET status = 'sent', sent_at = UTC_TIMESTAMP() WHERE id = ?")->execute([$newId]);
            $counts['sent']++;
        } catch (Throwable $e) {
            db()->prepare("UPDATE renewal_reminders SET status = 'failed', error_detail = ? WHERE id = ?")->execute([$e->getMessage(), $newId]);
            $counts['failed']++;
        }
    }
}

echo sprintf(
    "[%s] renewal_reminders: sent=%d skipped_no_credentials=%d failed=%d already_logged=%d\n",
    gmdate('Y-m-d H:i:s'),
    $counts['sent'],
    $counts['skipped'],
    $counts['failed'],
    $counts['already_logged']
);
