<?php
declare(strict_types=1);

// Replaces Postgres RLS. There is no row-level security in MySQL, so
// every access rule that used to live in a `create policy ...` in the
// Supabase migrations now has to be an explicit check here, called
// explicitly from every resource endpoint. The four role-scoping shapes
// below are exactly the ones the schema/RLS audit found repeating across
// the 13 original migrations — reuse these, don't re-derive per file.

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) return null;
    static $cached = null;
    if ($cached !== null) return $cached;
    $stmt = db()->prepare('SELECT id, email, phone, role, full_name FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return $cached = $row;
}

function require_login(): array
{
    $user = current_user();
    if (!$user) json_error('Not authenticated', 401);
    return $user;
}

// require_role('admin', 'staff') — 403s if the caller's role isn't in the
// allowed list. Pass no roles to just require *some* authenticated user.
function require_role(string ...$roles): array
{
    $user = require_login();
    if ($roles && !in_array($user['role'], $roles, true)) {
        json_error('Forbidden', 403);
    }
    return $user;
}

function is_back_office(array $user): bool
{
    return in_array($user['role'], ['admin', 'staff'], true);
}

// Shape 1: direct-column ownership (clients.owner_id, opportunities.owner_id,
// tasks.assigned_to, leads.assigned_to). Callers add `WHERE <col> = ?` with
// this id themselves when role === 'associate'.
function associate_scope_id(array $user): ?string
{
    return $user['role'] === 'associate' ? $user['id'] : null;
}

// Shape 2: indirect ownership via a client — client_policies, claims,
// communications, renewal_reminders all scope through clients.owner_id.
// Returns the list of client ids this associate owns, for an IN (...)
// filter; returns null for non-associates (meaning "no extra filter").
function owned_client_ids(string $userId): array
{
    $stmt = db()->prepare('SELECT id FROM clients WHERE owner_id = ?');
    $stmt->execute([$userId]);
    return array_column($stmt->fetchAll(), 'id');
}

// Shape 3: client self-service via clients.portal_user_id. Returns the
// single client row id linked to this portal user, or null if none.
function portal_client_id(string $userId): ?string
{
    $stmt = db()->prepare('SELECT id FROM clients WHERE portal_user_id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row['id'] ?? null;
}

// Central "can this user touch this client's data" check, covering both
// the associate-owner and client-portal-self shapes in one place — used
// by every client-scoped resource (client_policies, opportunities,
// claims, communications, renewal_reminders) after an admin/staff
// short-circuit.
function assert_can_access_client(array $user, string $clientId): void
{
    if (is_back_office($user)) return;
    if ($user['role'] === 'associate') {
        $stmt = db()->prepare('SELECT 1 FROM clients WHERE id = ? AND owner_id = ?');
        $stmt->execute([$clientId, $user['id']]);
        if ($stmt->fetch()) return;
    }
    if ($user['role'] === 'client') {
        $stmt = db()->prepare('SELECT 1 FROM clients WHERE id = ? AND portal_user_id = ?');
        $stmt->execute([$clientId, $user['id']]);
        if ($stmt->fetch()) return;
    }
    json_error('Forbidden', 403);
}
