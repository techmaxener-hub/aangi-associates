<?php
declare(strict_types=1);

// Retention & premium-at-risk numbers for the admin Retention page.
//
// What the data can and cannot say (kept honest on purpose):
//  * There is no "renewal paid" flag, so "at risk" is derived, not recorded:
//    an ACTIVE insurance policy that is due (or past due) and whose client has
//    had no logged contact in the last RETENTION_ENGAGED_DAYS days.
//  * A lapse has no date, so lapse analysis reports who is lapsed TODAY by
//    policy age / start-year cohort. It is not a time-to-lapse survival curve.
//  * Mutual Funds are monthly SIPs with no renewal or lapse concept and are
//    excluded throughout; premium here is always annual insurance premium.

const RETENTION_ENGAGED_DAYS = 60;
const RETENTION_MIN_SAMPLE = 10;

function ret_num($v): float { return round((float) ($v ?? 0), 2); }

function retention_stats(PDO $db, DateTimeImmutable $today): array
{
    $t = $today->format('Y-m-d');
    $d30 = $today->modify('+30 days')->format('Y-m-d');
    $d60 = $today->modify('+60 days')->format('Y-m-d');
    $d90 = $today->modify('+90 days')->format('Y-m-d');
    $engagedSince = $today->modify('-' . RETENTION_ENGAGED_DAYS . ' days')->format('Y-m-d 00:00:00');

    $all = function (string $sql, array $args = []) use ($db): array {
        $s = $db->prepare($sql);
        $s->execute($args);
        return $s->fetchAll();
    };
    $lastContact = '(SELECT client_id, MAX(occurred_at) AS last_at FROM communications GROUP BY client_id) lc ON lc.client_id = cp.client_id';
    $ins = "cp.product_type <> 'Mutual Fund'";

    // ---- 1. renewal pipeline: due bucket x engaged ----------------------------
    $buckets = ['overdue' => 'Overdue', 'd30' => 'Due in 30 days', 'd60' => 'Due in 31–60 days', 'd90' => 'Due in 61–90 days'];
    $pipeline = [];
    foreach ($buckets as $k => $label) {
        $pipeline[$k] = ['key' => $k, 'label' => $label, 'engaged' => ['count' => 0, 'premium' => 0.0], 'not_engaged' => ['count' => 0, 'premium' => 0.0]];
    }
    $rows = $all("SELECT CASE WHEN cp.renewal_date < ? THEN 'overdue' WHEN cp.renewal_date <= ? THEN 'd30' WHEN cp.renewal_date <= ? THEN 'd60' ELSE 'd90' END AS bucket,
            (lc.last_at IS NOT NULL AND lc.last_at >= ?) AS engaged, COUNT(*) AS n, COALESCE(SUM(cp.premium), 0) AS prem
        FROM client_policies cp LEFT JOIN $lastContact
        WHERE cp.status = 'active' AND $ins AND cp.renewal_date IS NOT NULL AND cp.renewal_date <= ?
        GROUP BY bucket, engaged", [$t, $d30, $d60, $engagedSince, $d90]);
    foreach ($rows as $r) {
        $side = (int) $r['engaged'] === 1 ? 'engaged' : 'not_engaged';
        $pipeline[$r['bucket']][$side] = ['count' => (int) $r['n'], 'premium' => ret_num($r['prem'])];
    }
    $pipeline = array_values($pipeline);
    $sum = fn (string $side, string $f) => array_sum(array_map(fn ($b) => $b[$side][$f], $pipeline));
    $dueCount = $sum('engaged', 'count') + $sum('not_engaged', 'count');
    $duePremium = round($sum('engaged', 'premium') + $sum('not_engaged', 'premium'), 2);
    $atRiskPremium = round($sum('not_engaged', 'premium'), 2);
    $overdue = $pipeline[0];

    // ---- 2. lapse by policy age and by start-year cohort ------------------------
    $lapseRate = fn (int $lapsed, int $active): ?float => ($lapsed + $active) > 0 ? round($lapsed / ($lapsed + $active) * 100, 1) : null;
    $age = [];
    foreach ($all("SELECT LEAST(TIMESTAMPDIFF(YEAR, start_date, ?), 3) AS band, SUM(status = 'active') a, SUM(status = 'lapsed') l, SUM(status = 'matured') m
        FROM client_policies cp WHERE $ins AND start_date IS NOT NULL AND start_date <= ? GROUP BY band ORDER BY band", [$t, $t]) as $r) {
        $b = (int) $r['band'];
        $age[] = [
            'label' => $b === 0 ? 'Under 1 year' : ($b >= 3 ? '3+ years' : "{$b}–" . ($b + 1) . ' years'),
            'active' => (int) $r['a'], 'lapsed' => (int) $r['l'], 'matured' => (int) $r['m'],
            'lapse_pct' => $lapseRate((int) $r['l'], (int) $r['a']),
        ];
    }
    $cohorts = [];
    foreach ($all("SELECT YEAR(start_date) AS yr, SUM(status = 'active') a, SUM(status = 'lapsed') l, SUM(status = 'matured') m
        FROM client_policies cp WHERE $ins AND start_date IS NOT NULL AND start_date <= ? GROUP BY yr ORDER BY yr", [$t]) as $r) {
        $cohorts[] = [
            'year' => (string) $r['yr'],
            'active' => (int) $r['a'], 'lapsed' => (int) $r['l'], 'matured' => (int) $r['m'],
            'lapse_pct' => $lapseRate((int) $r['l'], (int) $r['a']),
        ];
    }

    // ---- 3. overall + hot-spots ---------------------------------------------------
    $tot = $all("SELECT SUM(status = 'active') a, SUM(status = 'lapsed') l,
            COALESCE(SUM(CASE WHEN status = 'lapsed' THEN premium END), 0) lp,
            COALESCE(SUM(CASE WHEN status = 'active' THEN premium END), 0) ap
        FROM client_policies cp WHERE $ins")[0];
    $join = 'client_policies cp JOIN clients c ON c.id = cp.client_id LEFT JOIN product_categories pc ON pc.id = cp.category_id LEFT JOIN users u ON u.id = c.owner_id';
    $dims = ['segment' => "COALESCE(pc.name, 'Other')", 'product' => 'cp.product_type', 'insurer' => 'cp.insurer', 'associate' => "COALESCE(u.full_name, 'Unassigned')"];
    $hotspots = [];
    foreach ($dims as $key => $expr) {
        $rows = $all("SELECT $expr AS label, COUNT(*) AS total, SUM(cp.status = 'lapsed') AS lapsed,
                COALESCE(SUM(CASE WHEN cp.status = 'lapsed' THEN cp.premium END), 0) AS lp
            FROM $join WHERE $ins AND cp.status IN ('active', 'lapsed')
            GROUP BY label HAVING COUNT(*) >= " . RETENTION_MIN_SAMPLE . " ORDER BY (SUM(cp.status = 'lapsed') / COUNT(*)) DESC, lp DESC LIMIT 12");
        $hotspots[$key] = array_map(fn ($r) => [
            'label' => $r['label'],
            'policies' => (int) $r['total'],
            'lapsed' => (int) $r['lapsed'],
            'lapse_pct' => round((int) $r['lapsed'] / max(1, (int) $r['total']) * 100, 1),
            'lapsed_premium' => ret_num($r['lp']),
        ], $rows);
    }

    // ---- 4. call-these-first list -----------------------------------------------------
    $worklist = array_map(fn ($r) => [
        'policy_id' => $r['policy_id'], 'client_id' => $r['client_id'], 'client_name' => $r['client_name'], 'phone' => $r['phone'],
        'product_type' => $r['product_type'], 'premium' => ret_num($r['premium']), 'renewal_date' => $r['renewal_date'],
        'days_to_renewal' => (int) $r['days_to'], 'associate' => $r['associate'],
        'days_since_contact' => $r['last_at'] === null ? null : (int) $r['since'],
    ], $all("SELECT cp.id AS policy_id, c.id AS client_id, c.full_name AS client_name, c.phone, cp.product_type, cp.premium, cp.renewal_date,
            DATEDIFF(cp.renewal_date, ?) AS days_to, u.full_name AS associate, lc.last_at, DATEDIFF(?, lc.last_at) AS since
        FROM client_policies cp JOIN clients c ON c.id = cp.client_id LEFT JOIN users u ON u.id = c.owner_id LEFT JOIN $lastContact
        WHERE cp.status = 'active' AND $ins AND cp.renewal_date IS NOT NULL AND cp.renewal_date <= ?
          AND NOT (lc.last_at IS NOT NULL AND lc.last_at >= ?)
        ORDER BY cp.premium DESC, cp.renewal_date LIMIT 15", [$t, $t, $d30, $engagedSince]));

    return [
        'generated_at' => gmdate('c'),
        'today' => $t,
        'rules' => ['engaged_days' => RETENTION_ENGAGED_DAYS, 'min_sample' => RETENTION_MIN_SAMPLE],
        'summary' => [
            'due_90d_count' => $dueCount,
            'due_90d_premium' => $duePremium,
            'at_risk_premium' => $atRiskPremium,
            'at_risk_pct' => $duePremium > 0 ? round($atRiskPremium / $duePremium * 100, 1) : 0.0,
            'overdue_count' => $overdue['engaged']['count'] + $overdue['not_engaged']['count'],
            'overdue_premium' => round($overdue['engaged']['premium'] + $overdue['not_engaged']['premium'], 2),
            'lapse_pct' => $lapseRate((int) $tot['l'], (int) $tot['a']),
            'lapsed_count' => (int) $tot['l'],
            'lapsed_premium' => ret_num($tot['lp']),
            'active_premium' => ret_num($tot['ap']),
        ],
        'pipeline' => $pipeline,
        'by_age' => $age,
        'by_cohort' => $cohorts,
        'hotspots' => $hotspots,
        'worklist' => $worklist,
    ];
}
