<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/sms.php';

// One endpoint, action-routed via ?action=... — mirrors the small set of
// calls apps/crm/src/pages/{LoginEmail,LoginPhone}.tsx and
// AuthProvider.tsx made against supabase.auth.*.
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'session':
        // GET /api/auth.php?action=session — replaces supabase.auth.getSession()
        // + the profiles lookup AuthProvider.tsx did on top of it.
        json_out(['user' => current_user()]);
        break;

    case 'login':
        // POST — email+password, staff/admin/associate. Replaces
        // supabase.auth.signInWithPassword (LoginEmail.tsx).
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);
        $body = json_input();
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if ($email === '' || $password === '') json_error('email and password required', 422);

        $stmt = db()->prepare('SELECT id, password_hash, role, full_name FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if (!$row || !$row['password_hash'] || !password_verify($password, $row['password_hash'])) {
            json_error('Invalid email or password', 401);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = $row['id'];
        json_out(['user' => current_user()]);
        break;

    case 'logout':
        // POST — replaces supabase.auth.signOut(). Also what AuthProvider's
        // 20-minute idle timeout calls client-side.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);
        $_SESSION = [];
        session_destroy();
        json_out(['ok' => true]);
        break;

    case 'request_otp':
        // POST { phone } — replaces supabase.auth.signInWithOtp (LoginPhone.tsx
        // step 1). Supabase Auth used to handle SMS dispatch entirely
        // server-side via its configured provider; that provider doesn't
        // exist here, so this generates + stores + (if SMS_PROVIDER is
        // configured) sends a 6-digit code itself.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);
        $body = json_input();
        $phone = trim((string) ($body['phone'] ?? ''));
        if ($phone === '') json_error('phone required', 422);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $stmt = db()->prepare(
            'INSERT INTO otp_codes (id, phone, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))'
        );
        $stmt->execute([uuid4(), $phone, password_hash($code, PASSWORD_DEFAULT)]);

        $sent = send_sms($phone, "Your Aangi Associates login code is $code. It expires in 10 minutes.");
        json_out(['ok' => true, 'sms_sent' => $sent]);
        break;

    case 'verify_otp':
        // POST { phone, code } — replaces supabase.auth.verifyOtp (LoginPhone.tsx
        // step 2). On success: find-or-create a `users` row for this phone
        // (role=client), then replicate handle_new_user()'s auto-link — match
        // against clients.phone by last-10-digits and set portal_user_id.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('POST only', 405);
        $body = json_input();
        $phone = trim((string) ($body['phone'] ?? ''));
        $code = trim((string) ($body['code'] ?? ''));
        if ($phone === '' || $code === '') json_error('phone and code required', 422);

        $stmt = db()->prepare(
            'SELECT id, code_hash, attempts FROM otp_codes
             WHERE phone = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
             ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$phone]);
        $otp = $stmt->fetch();

        if (!$otp || $otp['attempts'] >= 5) json_error('Code expired or too many attempts — request a new one', 401);

        if (!password_verify($code, $otp['code_hash'])) {
            db()->prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$otp['id']]);
            json_error('Incorrect code', 401);
        }

        db()->prepare('UPDATE otp_codes SET consumed_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$otp['id']]);

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND role = ?');
            $stmt->execute([$phone, 'client']);
            $user = $stmt->fetch();

            if ($user) {
                $userId = $user['id'];
            } else {
                $userId = uuid4();
                $pdo->prepare('INSERT INTO users (id, phone, role) VALUES (?, ?, ?)')
                    ->execute([$userId, $phone, 'client']);

                // handle_new_user()'s phone auto-link: match the new user's
                // phone against clients.phone by last-10-digits (tolerant of
                // +91/formatting differences), first unlinked match only.
                $last10 = substr(preg_replace('/\D/', '', $phone), -10);
                $stmt = $pdo->prepare(
                    "SELECT id FROM clients WHERE portal_user_id IS NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = ? LIMIT 1"
                );
                $stmt->execute([$last10]);
                $match = $stmt->fetch();
                if ($match) {
                    $pdo->prepare('UPDATE clients SET portal_user_id = ? WHERE id = ?')
                        ->execute([$userId, $match['id']]);
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        json_out(['user' => current_user()]);
        break;

    default:
        json_error('Unknown action', 404);
}
