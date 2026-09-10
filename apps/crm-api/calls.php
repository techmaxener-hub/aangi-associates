<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors CallLogsDesk.tsx (list, manual log, re-queue). Also written by
// the reference (undeployed) telephony webhook once a real Exotel/Sarvam
// account exists — see apps/crm/supabase/functions/telephony-webhook for
// that still-undeployed piece; this endpoint is the manual-entry path.
//
// RLS this replaces (0007_telephony.sql): admin/staff only.

$user = require_role('admin', 'staff');
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET') {
    json_out(db()->query('SELECT * FROM calls ORDER BY created_at DESC')->fetchAll());
}

if ($method === 'POST') {
    $body = json_input();
    if (empty($body['lead_name']) || empty($body['phone'])) json_error('lead_name and phone are required', 422);

    $newId = uuid4();
    $stmt = db()->prepare(
        'INSERT INTO calls (id, lead_name, phone, source_channel, language_detected, duration_seconds, intent_score, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $newId, $body['lead_name'], $body['phone'], $body['source_channel'] ?? null, $body['language_detected'] ?? null,
        $body['duration_seconds'] ?? null, $body['intent_score'] ?? null, 'completed', $body['notes'] ?? null, $user['id'],
    ]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    $body = json_input();
    if (!array_key_exists('status', $body)) json_error('status is required', 422);
    db()->prepare('UPDATE calls SET status = ? WHERE id = ?')->execute([$body['status'], $id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
