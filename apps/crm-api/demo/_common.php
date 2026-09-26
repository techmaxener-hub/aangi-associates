<?php
declare(strict_types=1);

// Shared by seed_demo.php / flush_demo.php. CLI-only: these scripts write
// straight to the database named in ../env.php and must never be reachable
// over HTTP, so they refuse to run under any web SAPI.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require __DIR__ . '/../env.php';
require __DIR__ . '/../lib/uuid.php';

// Every demo row's primary key starts with this prefix, so the flush script
// can find exactly the demo data (and nothing real) with `id LIKE 'd3d30000-%'`.
const DEMO_PREFIX = 'd3d30000-';

function demo_id(): string { return 'd3d30000' . substr(uuid4(), 8); }

function demo_db(): PDO
{
    return new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}
