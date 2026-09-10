<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';

// ONE-TIME bootstrap: creates the first admin user. There's no way to
// generate a real bcrypt password hash from static seed.sql, so this is
// a tiny script instead — run it once (via curl or a browser POST), then
// DELETE THIS FILE. It refuses to run a second time once any admin
// already exists, as a safety net if you forget to delete it.
//
//   curl -X POST https://aa.tmarinternational.com/api/setup_admin.php \
//     -d "token=$SETUP_TOKEN&email=info@aangiassociates.com&password=...&full_name=Jainik Shah"
//
// SETUP_TOKEN must be defined in env.php (any random string) so this
// can't be triggered by a stranger who just finds the URL.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('POST only', 405);
}

if (!defined('SETUP_TOKEN') || SETUP_TOKEN === '' || ($_POST['token'] ?? '') !== SETUP_TOKEN) {
    json_error('Forbidden', 403);
}

$stmt = db()->query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
if ((int) $stmt->fetch()['n'] > 0) {
    json_error('An admin already exists — delete this file.', 409);
}

$email = trim((string) ($_POST['email'] ?? ''));
$password = (string) ($_POST['password'] ?? '');
$fullName = trim((string) ($_POST['full_name'] ?? ''));

if ($email === '' || strlen($password) < 8) {
    json_error('email and a password of at least 8 characters are required', 422);
}

$stmt = db()->prepare(
    'INSERT INTO users (id, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([uuid4(), $email, password_hash($password, PASSWORD_DEFAULT), 'admin', $fullName ?: null]);

json_out(['ok' => true, 'message' => 'Admin created. Delete setup_admin.php now.']);
