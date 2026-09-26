<?php
declare(strict_types=1);

// Shared read/write logic for Business Planning, used by both
// business_plans.php (CRUD) and business_plan_send.php (email — needs the
// same fully-computed plan shape to render into the email body). Pulled
// out of business_plans.php so the two endpoint files don't duplicate the
// achievement-computation query.

function assert_can_view_plan(array $user, array $plan): void
{
    if (is_back_office($user)) return;
    if ($user['role'] === 'associate' && $plan['associate_id'] === $user['id']) return;
    json_error('Forbidden', 403);
}

function create_or_replace_plan(array $user, array $body, ?string $id = null, ?array $old = null): array
{
    if (empty($body['associate_id'])) json_error('associate_id is required', 422);
    if (empty($body['period_type']) || empty($body['start_date']) || empty($body['end_date'])) {
        json_error('period_type, start_date and end_date are required', 422);
    }
    $targets = is_array($body['targets'] ?? null) ? $body['targets'] : [];
    if (!$targets) json_error('At least one category target is required', 422);

    $db = db();
    $db->beginTransaction();
    try {
        if ($id) {
            $db->prepare(
                'UPDATE business_plans SET associate_id = ?, period_type = ?, period_label = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ?'
            )->execute([
                $body['associate_id'], $body['period_type'], $body['period_label'] ?? '', $body['start_date'], $body['end_date'], $body['notes'] ?? null, $id,
            ]);
            $db->prepare('DELETE FROM business_plan_targets WHERE plan_id = ?')->execute([$id]);
        } else {
            $id = uuid4();
            $db->prepare(
                'INSERT INTO business_plans (id, associate_id, period_type, period_label, start_date, end_date, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $id, $body['associate_id'], $body['period_type'], $body['period_label'] ?? '', $body['start_date'], $body['end_date'], $body['notes'] ?? null, $user['id'],
            ]);
        }

        $insertTarget = $db->prepare(
            'INSERT INTO business_plan_targets (id, plan_id, category_id, expected_premium, expected_policy_count, commission_type, commission_value)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($targets as $t) {
            if (empty($t['category_id'])) continue;
            $insertTarget->execute([
                uuid4(),
                $id,
                $t['category_id'],
                $t['expected_premium'] ?? null,
                $t['expected_policy_count'] ?? null,
                ($t['commission_type'] ?? 'percent') === 'flat_per_policy' ? 'flat_per_policy' : 'percent',
                $t['commission_value'] ?? 0,
            ]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    $plan = fetch_plan($id);
    log_audit('business_plans', $id, $old ? 'update' : 'insert', $old, $plan);
    return $plan;
}

// Single source of truth for "what does this plan look like right now,
// including live-computed achievement" — used by every read path (list,
// detail, after create/update, email) so they can never drift from each
// other. Achievement is computed live from client_policies (never stored):
// joined through clients.owner_id to the plan's associate and category_id
// to the target's category, scoped to the plan's own start_date/end_date.
function fetch_plan(string $id): ?array
{
    $stmt = db()->prepare(
        'SELECT bp.*, u.full_name AS associate_name, u.email AS associate_email
         FROM business_plans bp JOIN users u ON u.id = bp.associate_id
         WHERE bp.id = ?'
    );
    $stmt->execute([$id]);
    $plan = $stmt->fetch();
    if (!$plan) return null;

    $targets = db()->prepare(
        'SELECT t.*, pc.name AS category_name
         FROM business_plan_targets t JOIN product_categories pc ON pc.id = t.category_id
         WHERE t.plan_id = ? ORDER BY pc.sort_order, pc.name'
    );
    $targets->execute([$id]);
    $targetRows = $targets->fetchAll();

    $ach = db()->prepare(
        'SELECT cp.category_id, SUM(cp.premium) AS achieved_premium, COUNT(*) AS achieved_count
         FROM client_policies cp JOIN clients c ON c.id = cp.client_id
         WHERE c.owner_id = ? AND cp.start_date BETWEEN ? AND ? AND cp.category_id IS NOT NULL
         GROUP BY cp.category_id'
    );
    $ach->execute([$plan['associate_id'], $plan['start_date'], $plan['end_date']]);
    $achByCategory = [];
    foreach ($ach->fetchAll() as $row) {
        $achByCategory[$row['category_id']] = [
            'achieved_premium' => (float) $row['achieved_premium'],
            'achieved_count' => (int) $row['achieved_count'],
        ];
    }

    $plan['targets'] = array_map(function (array $t) use ($achByCategory) {
        $a = $achByCategory[$t['category_id']] ?? ['achieved_premium' => 0.0, 'achieved_count' => 0];
        $rate = (float) $t['commission_value'];
        $t['achieved_premium'] = $a['achieved_premium'];
        $t['achieved_count'] = $a['achieved_count'];
        $t['commission_earned'] = round(
            $t['commission_type'] === 'percent' ? $a['achieved_premium'] * $rate / 100 : $a['achieved_count'] * $rate,
            2
        );
        $t['commission_expected'] = round(
            $t['commission_type'] === 'percent'
                ? ((float) ($t['expected_premium'] ?? 0)) * $rate / 100
                : ((float) ($t['expected_policy_count'] ?? 0)) * $rate,
            2
        );
        // PDO returns DECIMAL columns as PHP strings even with native
        // prepares — left uncast, json_encode would emit "500000.00" as a
        // JSON *string*, and the frontend's `acc.expected + t.expected_premium`
        // (types.ts's planTotals()) would then silently string-concatenate
        // instead of add. Cast every numeric target field explicitly so the
        // API always emits real JSON numbers.
        $t['expected_premium'] = $t['expected_premium'] !== null ? (float) $t['expected_premium'] : null;
        $t['expected_policy_count'] = $t['expected_policy_count'] !== null ? (int) $t['expected_policy_count'] : null;
        $t['commission_value'] = $rate;
        return $t;
    }, $targetRows);

    return $plan;
}

// All plans fully contained within [start,end] (default: current month),
// summed per associate and per category — powers the Consolidated tab and
// its export. "Contained within" (not "overlapping") so picking a period
// in the filter matches exactly the plans admin created for that period.
function fetch_consolidated(?string $startDate, ?string $endDate): array
{
    if (!$startDate || !$endDate) {
        $now = new DateTime('now', new DateTimeZone('UTC'));
        $startDate = $now->format('Y-m-01');
        $endDate = $now->format('Y-m-t');
    }

    $stmt = db()->prepare(
        'SELECT id FROM business_plans WHERE start_date >= ? AND end_date <= ? ORDER BY start_date'
    );
    $stmt->execute([$startDate, $endDate]);
    $planIds = array_column($stmt->fetchAll(), 'id');

    $byAssociate = [];
    $byCategory = [];
    foreach ($planIds as $planId) {
        $plan = fetch_plan($planId);
        if (!$plan) continue;
        $aid = $plan['associate_id'];
        if (!isset($byAssociate[$aid])) {
            $byAssociate[$aid] = [
                'associate_id' => $aid,
                'associate_name' => $plan['associate_name'],
                'plan_count' => 0,
                'expected_premium' => 0.0,
                'achieved_premium' => 0.0,
                'expected_count' => 0,
                'achieved_count' => 0,
                'commission_expected' => 0.0,
                'commission_earned' => 0.0,
            ];
        }
        $byAssociate[$aid]['plan_count']++;
        foreach ($plan['targets'] as $t) {
            $byAssociate[$aid]['expected_premium'] += (float) ($t['expected_premium'] ?? 0);
            $byAssociate[$aid]['achieved_premium'] += (float) $t['achieved_premium'];
            $byAssociate[$aid]['expected_count'] += (int) ($t['expected_policy_count'] ?? 0);
            $byAssociate[$aid]['achieved_count'] += (int) $t['achieved_count'];
            $byAssociate[$aid]['commission_expected'] += (float) $t['commission_expected'];
            $byAssociate[$aid]['commission_earned'] += (float) $t['commission_earned'];

            $cid = $t['category_id'];
            if (!isset($byCategory[$cid])) {
                $byCategory[$cid] = [
                    'category_id' => $cid,
                    'category_name' => $t['category_name'],
                    'expected_premium' => 0.0,
                    'achieved_premium' => 0.0,
                ];
            }
            $byCategory[$cid]['expected_premium'] += (float) ($t['expected_premium'] ?? 0);
            $byCategory[$cid]['achieved_premium'] += (float) $t['achieved_premium'];
        }
    }

    usort($byAssociate, fn($a, $b) => $b['achieved_premium'] <=> $a['achieved_premium']);

    return [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'associates' => array_values($byAssociate),
        'by_category' => array_values($byCategory),
    ];
}
