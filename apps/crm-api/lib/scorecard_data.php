<?php
declare(strict_types=1);
require_once __DIR__ . '/business_plan_data.php';

// Associate scorecards for the admin Scorecards page.
//
// How the numbers are built (kept simple and explainable on purpose):
//  * Seven measures per associate, each turned into a PERCENTILE RANK against
//    the other associates (0 = lowest, 100 = highest, 50 = the team median).
//    Percentiles make very different units comparable on one radar, and they
//    are robust to one outlier. A measure that needs a minimum sample
//    (SC_MIN_SAMPLE leads or tasks) is left out for an associate who has fewer,
//    rather than scoring a rate on 1-of-1.
//  * Overall standing = the average of the percentiles an associate has (at
//    least SC_MIN_AXES of the seven).
//  * "Achieved" for the month-end forecast is exactly Business Planning's rule
//    (premium of policies on clients the associate owns, started inside the plan
//    period), so the two pages agree. The forecast is a straight run-rate
//    projection (achieved so far / share of the period elapsed) and is withheld
//    until SC_MIN_ELAPSED of the period has passed. Sales are lumpy, so treat it
//    as a pace indicator, not a promise.

const SC_MIN_SAMPLE = 5;
const SC_MIN_AXES = 4;
const SC_MIN_ELAPSED = 0.15;

function sc_axes(): array
{
    return [
        ['key' => 'conversion', 'label' => 'Lead conversion', 'help' => 'Share of assigned leads that became clients'],
        ['key' => 'followup', 'label' => 'Follow-up', 'help' => 'Share of assigned leads that have been contacted (not left new)'],
        ['key' => 'sales', 'label' => 'Sales (90d)', 'help' => 'Policies started in the last 90 days on their clients'],
        ['key' => 'book', 'label' => 'Book size', 'help' => 'Annual insurance premium in force on their clients'],
        ['key' => 'activity', 'label' => 'Client contact', 'help' => 'Calls, messages and emails they logged in the last 30 days'],
        ['key' => 'tasks', 'label' => 'Task discipline', 'help' => 'Share of their tasks marked done'],
        ['key' => 'pace', 'label' => 'Plan pace', 'help' => 'Projected month-end premium as a share of target'],
    ];
}

/** Percentile rank (0-100) of each non-null value among the non-null values; ties share the mid-rank. */
function sc_percentiles(array $values): array
{
    $present = array_filter($values, fn ($v) => $v !== null);
    $n = count($present);
    $out = [];
    foreach ($values as $id => $v) {
        if ($v === null || $n === 0) { $out[$id] = null; continue; }
        $below = 0; $equal = 0;
        foreach ($present as $o) { if ($o < $v) $below++; elseif ($o == $v) $equal++; }
        $out[$id] = $n === 1 ? 50.0 : round(($below + 0.5 * $equal - 0.5) / ($n - 1) * 100, 1);
        $out[$id] = max(0.0, min(100.0, $out[$id]));
    }
    return $out;
}

function sc_median(array $values): ?float
{
    $v = array_values(array_filter($values, fn ($x) => $x !== null));
    if (!$v) return null;
    sort($v);
    $m = intdiv(count($v), 2);
    return count($v) % 2 ? (float) $v[$m] : ((float) $v[$m - 1] + (float) $v[$m]) / 2;
}

function scorecard_stats(PDO $db, DateTimeImmutable $today): array
{
    $t = $today->format('Y-m-d');
    $d30 = $today->modify('-29 days')->format('Y-m-d');
    $d90 = $today->modify('-89 days')->format('Y-m-d');
    $comms30 = $today->modify('-29 days')->format('Y-m-d 00:00:00');

    $all = function (string $sql, array $args = []) use ($db): array {
        $s = $db->prepare($sql);
        $s->execute($args);
        return $s->fetchAll();
    };
    $ins = "cp.product_type <> 'Mutual Fund'";

    $assoc = [];
    foreach ($all("SELECT id, full_name FROM users WHERE role = 'associate' ORDER BY full_name") as $r) {
        $assoc[$r['id']] = ['id' => $r['id'], 'name' => $r['full_name'] ?: 'Associate', 'raw' => [
            'leads' => 0, 'contacted' => 0, 'converted' => 0, 'untouched' => 0, 'oldest_untouched_days' => 0,
            'clients' => 0, 'active_policies' => 0, 'premium_in_force' => 0.0, 'sold_30d' => 0, 'sold_90d' => 0,
            'comms_30d' => 0, 'tasks' => 0, 'tasks_done' => 0, 'tasks_overdue' => 0,
        ]];
    }
    $set = function (array $rows, array $map) use (&$assoc): void {
        foreach ($rows as $r) {
            if (!isset($assoc[$r['id']])) continue;
            foreach ($map as $to => $from) $assoc[$r['id']]['raw'][$to] = is_float($assoc[$r['id']]['raw'][$to]) ? (float) $r[$from] : (int) $r[$from];
        }
    };

    $set($all("SELECT assigned_to AS id, COUNT(*) AS n, SUM(status IN ('contacted','qualified','converted')) AS contacted,
            SUM(status = 'converted') AS converted, SUM(status = 'new') AS untouched,
            COALESCE(MAX(CASE WHEN status = 'new' THEN DATEDIFF(?, created_at) END), 0) AS oldest
        FROM leads WHERE assigned_to IS NOT NULL GROUP BY assigned_to", [$t]),
        ['leads' => 'n', 'contacted' => 'contacted', 'converted' => 'converted', 'untouched' => 'untouched', 'oldest_untouched_days' => 'oldest']);

    $set($all('SELECT owner_id AS id, COUNT(*) AS n FROM clients WHERE owner_id IS NOT NULL GROUP BY owner_id'), ['clients' => 'n']);

    $set($all("SELECT c.owner_id AS id, SUM(cp.status = 'active' AND $ins) AS active_n,
            COALESCE(SUM(CASE WHEN cp.status = 'active' AND $ins THEN cp.premium END), 0) AS pif,
            SUM(cp.start_date >= ? AND cp.start_date <= ?) AS s30, SUM(cp.start_date >= ? AND cp.start_date <= ?) AS s90
        FROM client_policies cp JOIN clients c ON c.id = cp.client_id WHERE c.owner_id IS NOT NULL GROUP BY c.owner_id", [$d30, $t, $d90, $t]),
        ['active_policies' => 'active_n', 'premium_in_force' => 'pif', 'sold_30d' => 's30', 'sold_90d' => 's90']);

    $set($all("SELECT assigned_to AS id, COUNT(*) AS n, SUM(status = 'done') AS done, SUM(status <> 'done' AND due_date < ?) AS overdue
        FROM tasks WHERE assigned_to IS NOT NULL GROUP BY assigned_to", [$t]),
        ['tasks' => 'n', 'tasks_done' => 'done', 'tasks_overdue' => 'overdue']);

    $set($all('SELECT logged_by AS id, COUNT(*) AS n FROM communications WHERE logged_by IS NOT NULL AND occurred_at >= ? GROUP BY logged_by', [$comms30]),
        ['comms_30d' => 'n']);

    // ---- current plan + run-rate forecast (one plan per associate: the shortest covering today) ----
    $plans = [];
    foreach ($all('SELECT id, associate_id, start_date, end_date FROM business_plans WHERE start_date <= ? AND end_date >= ?', [$t, $t]) as $p) {
        $len = (new DateTimeImmutable($p['end_date']))->diff(new DateTimeImmutable($p['start_date']))->days;
        if (!isset($plans[$p['associate_id']]) || $len < $plans[$p['associate_id']]['len']) $plans[$p['associate_id']] = $p + ['len' => $len];
    }
    $planOut = [];
    foreach ($plans as $aid => $p) {
        if (!isset($assoc[$aid])) continue;
        $full = fetch_plan($p['id']);
        if (!$full) continue;
        $expected = 0.0; $achieved = 0.0;
        foreach ($full['targets'] as $tg) { $expected += (float) ($tg['expected_premium'] ?? 0); $achieved += (float) $tg['achieved_premium']; }

        $start = new DateTimeImmutable($p['start_date']);
        $end = new DateTimeImmutable($p['end_date']);
        $totalDays = $end->diff($start)->days + 1;
        $elapsed = min($totalDays, $today->diff($start)->days + 1);
        $frac = $elapsed / $totalDays;

        // cumulative achieved by day, using the same rule as fetch_plan
        $byDay = [];
        foreach ($all('SELECT cp.start_date AS d, SUM(cp.premium) AS prem FROM client_policies cp JOIN clients c ON c.id = cp.client_id
            WHERE c.owner_id = ? AND cp.start_date BETWEEN ? AND ? AND cp.category_id IS NOT NULL GROUP BY cp.start_date', [$aid, $p['start_date'], min($t, $p['end_date'])]) as $r) {
            $byDay[$r['d']] = (float) $r['prem'];
        }
        $daily = []; $run = 0.0;
        for ($i = 0; $i < $elapsed; $i++) {
            $run += $byDay[$start->modify("+$i days")->format('Y-m-d')] ?? 0.0;
            $daily[] = round($run, 2);
        }

        $projected = $frac >= SC_MIN_ELAPSED && $achieved > 0 ? round($achieved / $frac, 2) : ($frac >= SC_MIN_ELAPSED ? 0.0 : null);
        if ($expected <= 0) $pace = 'no_target';
        elseif ($achieved >= $expected) $pace = 'met';
        elseif ($projected === null) $pace = 'early';
        elseif ($projected >= $expected) $pace = 'on_pace';
        elseif ($projected >= 0.8 * $expected) $pace = 'slightly_behind';
        else $pace = 'behind';
        $remaining = max(0, $totalDays - $elapsed);

        $planOut[$aid] = [
            'id' => $p['id'], 'label' => $full['period_label'], 'start' => $p['start_date'], 'end' => $p['end_date'],
            'expected' => round($expected, 2), 'achieved' => round($achieved, 2), 'total_days' => $totalDays, 'elapsed_days' => $elapsed,
            'projected' => $projected, 'pace' => $pace, 'daily' => $daily,
            'needed_per_day' => ($achieved < $expected && $remaining > 0) ? round(($expected - $achieved) / $remaining, 2) : null,
            'pace_ratio' => ($projected !== null && $expected > 0) ? round($projected / $expected * 100, 1) : null,
        ];
    }

    // ---- axes: raw -> percentile ----------------------------------------------------------
    $rate = fn (int $num, int $den): ?float => $den >= SC_MIN_SAMPLE ? $num / $den : null;
    $metric = ['conversion' => [], 'followup' => [], 'sales' => [], 'book' => [], 'activity' => [], 'tasks' => [], 'pace' => []];
    foreach ($assoc as $id => $a) {
        $r = $a['raw'];
        $metric['conversion'][$id] = $rate($r['converted'], $r['leads']);
        $metric['followup'][$id] = $rate($r['contacted'], $r['leads']);
        $metric['sales'][$id] = (float) $r['sold_90d'];
        $metric['book'][$id] = (float) $r['premium_in_force'];
        $metric['activity'][$id] = (float) $r['comms_30d'];
        $metric['tasks'][$id] = $rate($r['tasks_done'], $r['tasks']);
        $metric['pace'][$id] = isset($planOut[$id]) && $planOut[$id]['pace_ratio'] !== null ? (float) $planOut[$id]['pace_ratio'] : null;
    }
    $pct = array_map('sc_percentiles', $metric);

    $out = [];
    foreach ($assoc as $id => $a) {
        $p = [];
        foreach ($pct as $axis => $byId) $p[$axis] = $byId[$id];
        $have = array_filter($p, fn ($v) => $v !== null);
        $r = $a['raw'];
        $out[] = [
            'id' => $id, 'name' => $a['name'], 'raw' => $r + [
                'conversion_pct' => $r['leads'] >= SC_MIN_SAMPLE ? round($r['converted'] / $r['leads'] * 100, 1) : null,
                'contacted_pct' => $r['leads'] >= SC_MIN_SAMPLE ? round($r['contacted'] / $r['leads'] * 100, 1) : null,
                'tasks_done_pct' => $r['tasks'] >= SC_MIN_SAMPLE ? round($r['tasks_done'] / $r['tasks'] * 100, 1) : null,
            ],
            'pct' => $p,
            'score' => count($have) >= SC_MIN_AXES ? round(array_sum($have) / count($have), 1) : null,
            'plan' => $planOut[$id] ?? null,
        ];
    }
    usort($out, fn ($x, $y) => [$y['score'] ?? -1, $y['raw']['premium_in_force']] <=> [$x['score'] ?? -1, $x['raw']['premium_in_force']]);

    $team = ['associates' => count($out), 'with_plan' => count($planOut), 'median' => []];
    foreach (['conversion_pct', 'contacted_pct', 'sold_90d', 'premium_in_force', 'comms_30d', 'tasks_done_pct'] as $k) {
        $team['median'][$k] = sc_median(array_map(fn ($a) => $a['raw'][$k], $out));
    }
    $exp = array_sum(array_map(fn ($p) => $p['expected'], $planOut));
    $ach = array_sum(array_map(fn ($p) => $p['achieved'], $planOut));
    $proj = array_sum(array_map(fn ($p) => $p['projected'] ?? $p['achieved'], $planOut));
    $team['plan'] = [
        'expected' => round($exp, 2), 'achieved' => round($ach, 2), 'projected' => round($proj, 2),
        'behind' => count(array_filter($planOut, fn ($p) => in_array($p['pace'], ['behind', 'slightly_behind'], true))),
        'on_pace' => count(array_filter($planOut, fn ($p) => in_array($p['pace'], ['on_pace', 'met'], true))),
        'early' => count(array_filter($planOut, fn ($p) => $p['pace'] === 'early')),
    ];

    return [
        'generated_at' => gmdate('c'),
        'today' => $t,
        'rules' => ['min_sample' => SC_MIN_SAMPLE, 'min_axes' => SC_MIN_AXES, 'min_elapsed_pct' => (int) (SC_MIN_ELAPSED * 100)],
        'axes' => sc_axes(),
        'team' => $team,
        'associates' => $out,
    ];
}
