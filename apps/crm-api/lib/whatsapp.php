<?php
declare(strict_types=1);

// Shared by cron/renewal_reminders.php and cron/birthday_wishes.php — pulled
// out so both crons send through the exact same credential lookup and the
// exact same WhatsApp Cloud API call, rather than keeping two copies that
// could quietly drift apart.

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

/** Fills {{placeholders}} in an admin-edited template; an unknown placeholder is left as-is rather than silently dropped. */
function render_template(string $template, array $vars): string
{
    return preg_replace_callback('/\{\{(\w+)\}\}/', function ($m) use ($vars) {
        return array_key_exists($m[1], $vars) ? (string) $vars[$m[1]] : $m[0];
    }, $template);
}

/** message_templates is a singleton seeded by seed.sql; this fallback only matters if that row is ever missing. */
function message_template(string $column, string $fallback): string
{
    $stmt = db()->prepare("SELECT $column FROM message_templates WHERE id = 1");
    $stmt->execute();
    $val = $stmt->fetchColumn();
    return $val !== false && trim((string) $val) !== '' ? $val : $fallback;
}
