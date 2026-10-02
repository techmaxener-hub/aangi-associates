<?php
// Copy to env.php (gitignored, never committed) and fill in real values
// from Hostinger's hPanel → Databases → MySQL Databases.
define('DB_HOST', 'localhost');
define('DB_NAME', '');
define('DB_USER', '');
define('DB_PASS', '');

// Any random string — protects setup_admin.php's one-time bootstrap
// endpoint. Delete setup_admin.php after using it once.
define('SETUP_TOKEN', '');

// WhatsApp Cloud API — used by cron/renewal_reminders.php. Leave both
// empty to have reminders generate and log as 'skipped_no_credentials'
// instead of sending, same honest-degradation pattern as the rest of
// this project's integrations.
define('WHATSAPP_SYSTEM_TOKEN', '');
define('WHATSAPP_PHONE_NUMBER_ID', '');

// SMS gateway for client-portal OTP delivery. Leave empty to have OTP
// codes generated and logged (visible in server logs / the otp_codes
// table) instead of actually sent — fine for testing, not for production
// client use until a real provider is configured.
define('SMS_PROVIDER', ''); // e.g. 'msg91', 'twilio' — checked by lib/sms.php
define('SMS_API_KEY', '');
define('SMS_SENDER_ID', '');

// Outgoing "From" address for Business Planning's "Send Email" action
// (lib/mailer.php). Unlike WhatsApp/SMS above, this doesn't need a third-
// party account — PHP's mail() uses the host's own mail transport, which
// Hostinger shared hosting provides out of the box for domains it hosts.
// Deliverability without SPF/DKIM configured for this subdomain isn't
// guaranteed; the From address below should be a real mailbox on the
// domain if one exists.
define('MAIL_FROM_ADDRESS', 'no-reply@tmarinternational.com');
define('MAIL_FROM_NAME', 'Aangi Associates');

// Public base URL this API is actually reachable at — used only to build
// the dispatch_token redirect link embedded in the daily intimation
// digest's PDF/email (lib/intimation.php). Defaults to the locked
// production URL if left empty, so this only needs setting for a
// non-default install.
define('APP_BASE_URL', 'https://aa.tmarinternational.com/api');
