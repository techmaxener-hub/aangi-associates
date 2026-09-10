<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';

// Mirrors DialerRulesCard.tsx. RLS this replaces (0007_telephony.sql):
// admin-only, singleton row (id=1, seeded by seed.sql).

require_role('admin');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $row = db()->query('SELECT delay_seconds, max_retries, post_call_whatsapp_template FROM dialer_rules WHERE id = 1')->fetch();
    json_out($row ?: null);
}

if ($method === 'PUT') {
    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['delay_seconds', 'max_retries', 'post_call_whatsapp_template'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    db()->prepare('UPDATE dialer_rules SET ' . implode(', ', $fields) . ' WHERE id = 1')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
