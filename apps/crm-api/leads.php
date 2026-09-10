<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors LeadsDeskPage.tsx (list w/ assignee join, assign, status
// transitions), ManualLeadEntry.tsx (create), BulkLeadUpload.tsx (bulk
// import via {bulk:[...]}), GlobalSearch.tsx (?search=).
//
// RLS this replaces (0002/0009/0010): admin/staff full CRUD; associate
// select+update only where assigned_to = self (no associate insert —
// same direct-column-ownership shape as tasks.assigned_to).

$user = require_role('admin', 'staff', 'associate');
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET') {
    $where = [];
    $params = [];
    if ($user['role'] === 'associate') {
        $where[] = 'l.assigned_to = ?';
        $params[] = $user['id'];
    }
    if (!empty($_GET['search'])) {
        $where[] = '(l.full_name LIKE ? OR l.phone LIKE ?)';
        $like = '%' . $_GET['search'] . '%';
        $params[] = $like;
        $params[] = $like;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $stmt = db()->prepare(
        "SELECT l.*, a.id AS assignee_id, a.full_name AS assignee_full_name, a.role AS assignee_role
         FROM leads l LEFT JOIN users a ON a.id = l.assigned_to
         $whereSql ORDER BY l.updated_at DESC"
    );
    $stmt->execute($params);
    json_out(array_map(function (array $row): array {
        $row['assignee'] = $row['assignee_id'] ? ['id' => $row['assignee_id'], 'full_name' => $row['assignee_full_name'], 'role' => $row['assignee_role']] : null;
        unset($row['assignee_id'], $row['assignee_full_name'], $row['assignee_role']);
        return $row;
    }, $stmt->fetchAll()));
}

if ($method === 'POST') {
    if ($user['role'] === 'associate') json_error('Forbidden', 403);
    $body = json_input();

    // Bulk-import mode (BulkLeadUpload.tsx): { bulk: [{full_name, phone, ...}] }.
    // Dedupe against EXISTING rows via a single parameterized IN(...) query —
    // never a raw .or()-built string from unescaped input (that pattern was
    // flagged as a risk in the original Supabase code and deliberately not
    // repeated here).
    if (!empty($body['bulk']) && is_array($body['bulk'])) {
        $rows = $body['bulk'];
        $phones = array_values(array_filter(array_column($rows, 'phone')));
        $emails = array_values(array_filter(array_column($rows, 'email')));

        $existingPhones = [];
        $existingEmails = [];
        if ($phones) {
            $placeholders = implode(',', array_fill(0, count($phones), '?'));
            $stmt = db()->prepare("SELECT phone FROM leads WHERE phone IN ($placeholders)");
            $stmt->execute($phones);
            $existingPhones = array_column($stmt->fetchAll(), 'phone');
        }
        if ($emails) {
            $placeholders = implode(',', array_fill(0, count($emails), '?'));
            $stmt = db()->prepare("SELECT email FROM leads WHERE email IN ($placeholders)");
            $stmt->execute($emails);
            $existingEmails = array_column($stmt->fetchAll(), 'email');
        }

        $insert = db()->prepare(
            'INSERT INTO leads (id, full_name, phone, email, city, lead_type, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $inserted = 0;
        $skipped = 0;
        foreach ($rows as $row) {
            $phone = $row['phone'] ?? null;
            $email = $row['email'] ?? null;
            if (($phone && in_array($phone, $existingPhones, true)) || ($email && in_array($email, $existingEmails, true))) {
                $skipped++;
                continue;
            }
            $insert->execute([uuid4(), $row['full_name'] ?? '', $phone, $email, $row['city'] ?? null, $row['lead_type'] ?? null, 'bulk_upload', $user['id']]);
            $inserted++;
        }
        json_out(['inserted' => $inserted, 'skipped' => $skipped], 201);
    }

    // Manual entry mode (ManualLeadEntry.tsx).
    if (empty($body['full_name']) || empty($body['phone'])) json_error('full_name and phone are required', 422);
    $newId = uuid4();
    $stmt = db()->prepare(
        'INSERT INTO leads (id, full_name, phone, email, city, lead_type, source, owner, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $newId, $body['full_name'], $body['phone'], $body['email'] ?? null, $body['city'] ?? null,
        $body['lead_type'] ?? null, 'manual', $body['owner'] ?? null, $body['notes'] ?? null, $user['id'],
    ]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    if ($user['role'] === 'associate') {
        $stmt = db()->prepare('SELECT 1 FROM leads WHERE id = ? AND assigned_to = ?');
        $stmt->execute([$id, $user['id']]);
        if (!$stmt->fetch()) json_error('Forbidden', 403);
    }
    $body = json_input();
    $fields = ['updated_at = UTC_TIMESTAMP()'];
    $params = [];
    foreach (['assigned_to', 'status', 'notes', 'converted_client_id'] as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    $params[] = $id;
    db()->prepare('UPDATE leads SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
