<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/uuid.php';
require __DIR__ . '/lib/auth.php';

// Mirrors TasksPage.tsx (list w/ joins, create, status update) and the
// linked-tasks sub-query in CandidateDetailPage.tsx (?linked_candidate_id=).
//
// RLS this replaces (0004_crm_core.sql): admin/staff full CRUD; associate
// select+update ONLY where assigned_to = self (no associate insert — same
// direct-column-ownership shape as leads.assigned_to).

$user = require_role('admin', 'staff', 'associate');
$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

if ($method === 'GET') {
    $where = [];
    $params = [];
    if ($user['role'] === 'associate') {
        $where[] = 't.assigned_to = ?';
        $params[] = $user['id'];
    }
    if (!empty($_GET['linked_candidate_id'])) {
        $where[] = 't.linked_candidate_id = ?';
        $params[] = $_GET['linked_candidate_id'];
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    // Mirrors the assignee/linked_client/linked_candidate joins TasksPage.tsx
    // requested via Supabase's embedded-resource select syntax.
    $stmt = db()->prepare(
        "SELECT t.*,
                a.id AS assignee_id, a.full_name AS assignee_full_name, a.role AS assignee_role,
                c.id AS linked_client_id_r, c.full_name AS linked_client_full_name,
                cd.id AS linked_candidate_id_r, cd.full_name AS linked_candidate_full_name
         FROM tasks t
         LEFT JOIN users a ON a.id = t.assigned_to
         LEFT JOIN clients c ON c.id = t.linked_client_id
         LEFT JOIN candidates cd ON cd.id = t.linked_candidate_id
         $whereSql
         ORDER BY t.due_date"
    );
    $stmt->execute($params);
    json_out(array_map('shape_task_row', $stmt->fetchAll()));
}

if ($method === 'POST') {
    // No associate insert policy existed before — keep that.
    if ($user['role'] === 'associate') json_error('Forbidden', 403);
    $body = json_input();
    if (empty($body['title'])) json_error('title is required', 422);

    $newId = uuid4();
    $stmt = db()->prepare(
        'INSERT INTO tasks (id, title, description, assigned_to, due_date, linked_client_id, linked_candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $newId,
        $body['title'],
        $body['description'] ?? null,
        $body['assigned_to'] ?? null,
        $body['due_date'] ?? null,
        $body['linked_client_id'] ?? null,
        $body['linked_candidate_id'] ?? null,
        $user['id'],
    ]);
    json_out(['id' => $newId], 201);
}

if ($method === 'PUT' && $id) {
    $body = json_input();
    if (!array_key_exists('status', $body)) json_error('status is required', 422);

    if ($user['role'] === 'associate') {
        $stmt = db()->prepare('SELECT 1 FROM tasks WHERE id = ? AND assigned_to = ?');
        $stmt->execute([$id, $user['id']]);
        if (!$stmt->fetch()) json_error('Forbidden', 403);
    }
    db()->prepare('UPDATE tasks SET status = ? WHERE id = ?')->execute([$body['status'], $id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);

// Reshapes the flat join columns above into the nested {assignee, linked_client,
// linked_candidate} objects TasksPage.tsx already expects, so the frontend
// port doesn't need to change how it reads the response.
function shape_task_row(array $row): array
{
    $assignee = $row['assignee_id'] ? ['id' => $row['assignee_id'], 'full_name' => $row['assignee_full_name'], 'role' => $row['assignee_role']] : null;
    $linkedClient = $row['linked_client_id_r'] ? ['id' => $row['linked_client_id_r'], 'full_name' => $row['linked_client_full_name']] : null;
    $linkedCandidate = $row['linked_candidate_id_r'] ? ['id' => $row['linked_candidate_id_r'], 'full_name' => $row['linked_candidate_full_name']] : null;
    foreach (['assignee_id', 'assignee_full_name', 'assignee_role', 'linked_client_id_r', 'linked_client_full_name', 'linked_candidate_id_r', 'linked_candidate_full_name'] as $k) {
        unset($row[$k]);
    }
    $row['assignee'] = $assignee;
    $row['linked_client'] = $linkedClient;
    $row['linked_candidate'] = $linkedCandidate;
    return $row;
}
