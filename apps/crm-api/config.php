<?php
// apps/crm-api/config.php — DB connection + session config for the whole
// API. Every resource file starts with `require __DIR__ . '/config.php';`.
// Plain PHP, PDO/MySQL only — no Composer dependencies, so this runs on
// any generic PHP 8 shared-hosting account (Hostinger Business hosting
// included) with zero setup beyond a MySQL database.

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0'); // never leak stack traces to API responses
ini_set('log_errors', '1');

// ---- Environment ------------------------------------------------------
// Hostinger doesn't give you a process-level env-var UI for shared PHP
// hosting the way Vite/Node does, so these are read from a sibling
// `env.php` (gitignored, never committed) that just sets constants. A
// `env.example.php` ships in the repo as the template.
$envFile = __DIR__ . '/env.php';
if (is_file($envFile)) {
    require $envFile;
}

foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'] as $const) {
    if (!defined($const)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => "Server misconfigured: $const not set. Copy env.example.php to env.php and fill in real values."]);
        exit;
    }
}

// ---- Session ------------------------------------------------------------
// Same-origin cookie session (CRM SPA at /app/, API at /api/, same host)
// — no CORS, no token handling needed on the frontend.
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']),
    'samesite' => 'Lax',
]);
session_start();

// ---- DB -----------------------------------------------------------------
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

// ---- JSON helpers ---------------------------------------------------------
function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400): void
{
    json_out(['error' => $message], $status);
}

set_exception_handler(function (Throwable $e) {
    error_log('[crm-api] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    json_error('Internal server error', 500);
});
