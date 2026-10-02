<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';

// Mirrors MessageTemplatesCard.tsx. Admin-only, singleton row (id=1, seeded
// by seed.sql) — same shape as dialer_rules.php. Both cron/renewal_reminders.php
// and cron/birthday_wishes.php read these templates at send time; this
// endpoint only edits the stored wording, it never sends anything itself.

require_role('admin');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $row = db()->query('SELECT birthday_whatsapp_template, renewal_whatsapp_template, updated_at FROM message_templates WHERE id = 1')->fetch();
    json_out($row ?: null);
}

if ($method === 'PUT') {
    $body = json_input();
    $fields = [];
    $params = [];
    foreach (['birthday_whatsapp_template', 'renewal_whatsapp_template'] as $col) {
        if (array_key_exists($col, $body)) {
            if (trim((string) $body[$col]) === '') json_error("$col cannot be empty", 422);
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    $fields[] = 'updated_by = ?';
    $params[] = $_SESSION['user_id'] ?? null;
    db()->prepare('UPDATE message_templates SET ' . implode(', ', $fields) . ' WHERE id = 1')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
