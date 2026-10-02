<?php
declare(strict_types=1);
require_once __DIR__ . '/whatsapp.php'; // render_template(), message_template()
require_once __DIR__ . '/uuid.php'; // uuid4()

// Admin/Staff intimation digest — see intimations.php, intimation_redirect.php,
// cron/daily_intimation.php. Never contacts a client directly: this only
// ever builds a PRE-FILLED wa.me link for an admin/staff member to review
// and press themselves (per the explicit pivot away from any automatic
// client-facing send). intimation_items just tracks identity (one row per
// kind+client+policy+day) and a dispatch_token + clicked_at for "did a
// human act on this" — the actual message text is always rendered live
// from the CURRENT message_templates row, never stored, so an admin
// editing the template instantly updates the wording for every pending
// item, past or future.

function intimation_dispatch_token(): string
{
    return bin2hex(random_bytes(16)); // 32 hex chars
}

/** Renders this row's message from the live template — shared by intimation_due_items() and intimation_redirect.php so the two never drift apart. */
function intimation_build_message(string $kind, string $fullName, ?string $productType, ?string $renewalDate, string $forDate): string
{
    $vars = ['name' => $fullName];
    if ($kind === 'birthday') {
        $template = message_template(
            'birthday_whatsapp_template',
            'Happy Birthday, {{name}}! 🎉 Wishing you a wonderful year ahead, from all of us at Aangi Associates.'
        );
    } else {
        $days = $renewalDate ? (int) round((strtotime($renewalDate) - strtotime($forDate)) / 86400) : 0;
        $vars['product'] = $productType ?? 'policy';
        $vars['renewal_date'] = $renewalDate ? date('d M Y', strtotime($renewalDate)) : '—';
        $vars['days'] = (string) $days;
        $template = message_template(
            'renewal_whatsapp_template',
            'Hi {{name}}, this is a reminder from Aangi Associates: your {{product}} policy is due for renewal on {{renewal_date}} (in {{days}} days). Reply here or call us to renew without a break in cover.'
        );
    }
    return render_template($template, $vars);
}

/**
 * Finds today's (or any given date's) due birthdays and renewals and makes
 * sure each one has an intimation_items row (creating one with a fresh
 * dispatch_token the first time it's seen) — idempotent, safe to call many
 * times for the same date. Renewals use a rolling 60-day window (matching
 * the "soon" threshold PoliciesTab already shows), not a fixed milestone
 * match, so a missed digest run never permanently skips an item.
 */
function intimation_ensure_items(string $forDate): void
{
    $stmt = db()->prepare(
        'SELECT id FROM clients WHERE date_of_birth IS NOT NULL AND MONTH(date_of_birth) = MONTH(?) AND DAY(date_of_birth) = DAY(?)'
    );
    $stmt->execute([$forDate, $forDate]);
    foreach ($stmt->fetchAll() as $c) {
        // MySQL unique indexes allow multiple rows with a NULL policy_id, so
        // the schema's UNIQUE constraint alone can't dedupe birthday rows —
        // check explicitly instead of relying on INSERT IGNORE here.
        $exists = db()->prepare(
            "SELECT 1 FROM intimation_items WHERE kind = 'birthday' AND client_id = ? AND policy_id IS NULL AND scheduled_for = ?"
        );
        $exists->execute([$c['id'], $forDate]);
        if ($exists->fetch()) continue;
        db()->prepare(
            "INSERT INTO intimation_items (id, kind, client_id, policy_id, scheduled_for, dispatch_token) VALUES (?, 'birthday', ?, NULL, ?, ?)"
        )->execute([uuid4(), $c['id'], $forDate, intimation_dispatch_token()]);
    }

    $stmt = db()->prepare(
        'SELECT cp.id AS policy_id, cp.client_id
         FROM client_policies cp
         WHERE cp.status = "active" AND cp.renewal_date BETWEEN ? AND DATE_ADD(?, INTERVAL 60 DAY)'
    );
    $stmt->execute([$forDate, $forDate]);
    foreach ($stmt->fetchAll() as $p) {
        $insert = db()->prepare(
            "INSERT IGNORE INTO intimation_items (id, kind, client_id, policy_id, scheduled_for, dispatch_token) VALUES (?, 'renewal', ?, ?, ?, ?)"
        );
        $insert->execute([uuid4(), $p['client_id'], $p['policy_id'], $forDate, intimation_dispatch_token()]);
    }
}

/** @return list<array<string,mixed>> */
function intimation_due_items(string $forDate): array
{
    intimation_ensure_items($forDate);

    $stmt = db()->prepare(
        'SELECT ii.id, ii.kind, ii.dispatch_token, ii.clicked_at, ii.scheduled_for,
                c.id AS client_id, c.full_name, c.phone,
                cp.id AS policy_id, cp.product_type, cp.renewal_date
         FROM intimation_items ii
         JOIN clients c ON c.id = ii.client_id
         LEFT JOIN client_policies cp ON cp.id = ii.policy_id
         WHERE ii.scheduled_for = ?
         ORDER BY ii.kind, c.full_name'
    );
    $stmt->execute([$forDate]);

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $message = intimation_build_message($row['kind'], $row['full_name'], $row['product_type'], $row['renewal_date'], $forDate);
        $items[] = [
            'id' => $row['id'],
            'kind' => $row['kind'],
            'client_id' => $row['client_id'],
            'client_name' => $row['full_name'],
            'client_phone' => $row['phone'],
            'policy_id' => $row['policy_id'],
            'product_type' => $row['product_type'],
            'renewal_date' => $row['renewal_date'],
            'dispatch_token' => $row['dispatch_token'],
            'clicked_at' => $row['clicked_at'],
            'message' => $message,
            'wa_link' => intimation_wa_link($row['phone'], $message),
            'redirect_link' => intimation_redirect_url($row['dispatch_token']),
        ];
    }
    return $items;
}

function intimation_wa_link(string $phone, string $message): string
{
    $digits = preg_replace('/\D/', '', $phone) ?? '';
    $waPhone = strlen($digits) === 10 ? "91$digits" : $digits;
    return 'https://wa.me/' . $waPhone . '?text=' . rawurlencode($message);
}

/** The link embedded in the PDF/email — token-gated, no login required, marks clicked_at then 302s to the real wa.me link (see intimation_redirect.php). */
function intimation_redirect_url(string $token): string
{
    $base = defined('APP_BASE_URL') && APP_BASE_URL !== '' ? APP_BASE_URL : 'https://aa.tmarinternational.com/api';
    return rtrim($base, '/') . '/intimation_redirect.php?token=' . $token;
}
