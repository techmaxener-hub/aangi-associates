<?php
declare(strict_types=1);

// SMS dispatch for client-portal OTP delivery. No SMS gateway account
// exists yet (same honest gap as the telephony/WhatsApp integrations
// elsewhere in this project) — if SMS_PROVIDER isn't configured in
// env.php, this logs instead of sending, and the caller is told so
// explicitly rather than getting a fake "sent" response. Swap the body
// of the `if` block below for a real provider's API call (e.g. MSG91,
// Twilio) once real credentials exist.
function send_sms(string $phone, string $message): bool
{
    if (!defined('SMS_PROVIDER') || SMS_PROVIDER === '' || !defined('SMS_API_KEY') || SMS_API_KEY === '') {
        error_log("[crm-api] SMS not configured — would send to $phone: $message");
        return false;
    }

    // Placeholder for a real gateway integration once credentials exist.
    // Left unimplemented deliberately rather than faking a provider.
    error_log("[crm-api] SMS_PROVIDER=" . SMS_PROVIDER . " configured but no dispatch code written yet — would send to $phone: $message");
    return false;
}
