<?php
declare(strict_types=1);

// Aggregates for the admin dashboard, computed in SQL so the browser doesn't
// have to download every lead/policy/task just to draw charts (the previous
// dashboard fetched whole lists and tallied them client-side — fine at 50
// rows, not at the 900+ leads / 500+ clients a real book reaches).
//
// Kept out of dashboard.php as a pure function of ($db, $today) so it can
// also be run from the CLI against a database without a web session.
//
// Money note: client_policies.premium means an ANNUAL premium for insurance
// products but a MONTHLY SIP amount for Mutual Funds. Those are never summed
// together here — "premium in force" is insurance only, and the SIP book is
// reported separately.

const DASH_WEEKS = 12;
const DASH_MF = 'Mutual Fund';

function dash_int($v): int { return (int) ($v ?? 0); }
function dash_num($v): float { return round((float) ($v ?? 0), 2); }

/** @return array<int,int> weekly counts, index 0 = oldest week … 11 = the last 7 days */
function dash_weekly(array $rows): array
{
    $out = array_fill(0, DASH_WEEKS, 0);
    foreach ($rows as $r) {
        $k = dash_int($r['k']);
        if ($k >= 0 && $k < DASH_WEEKS) $out[DASH_WEEKS - 1 - $k] = dash_int($r['n']);
    }
    return $out;
}

function dashboard_stats(PDO $db, DateTimeImmutable $today): array
{
    $t = $today->format('Y-m-d');
    $d30 = $today->modify('-30 days')->format('Y-m-d');
    $d60 = $today->modify('-60 days')->format('Y-m-d');
    $d84 = $today->modify('-' . (DASH_WEEKS * 7 - 1) . ' days')->format('Y-m-d');
    $d7 = $today->modify('+7 days')->format('Y-m-d');
    $d60f = $today->modify('+60 days')->format('Y-m-d');
    $monthStart = $today->modify('first day of this month');
    $firstNewBizMonth = $monthStart->modify('-5 months')->format('Y-m-d');
    $renewalEnd = $monthStart->modify('+6 months')->modify('-1 day')->format('Y-m-d');

    $one = function (string $sql, array $args = []) use ($db): array {
        $s = $db->prepare($sql); $s->execute($args); return $s->fetch() ?: [];
    };
    $all = function (string $sql, array $args = []) use ($db): array {
        $s = $db->prepare($sql); $s->execute($args); return $s->fetchAll();
    };
    $weekExpr = 'GREATEST(0, FLOOR(DATEDIFF(?, DATE(%s)) / 7))';

    // ---- clients -------------------------------------------------------
    $c = $one('SELECT COUNT(*) total, SUM(created_at >= ?) c30, SUM(created_at >= ? AND created_at < ?) p30 FROM clients', [$d30, $d60, $d30]);
    $clientsWeekly = dash_weekly($all(
        sprintf("SELECT $weekExpr k, COUNT(*) n FROM clients WHERE DATE(created_at) >= ? GROUP BY k", 'created_at'), [$t, $d84]));

    // ---- policies ------------------------------------------------------
    $p = $one("SELECT
            SUM(status = 'active') active_n,
            SUM(status = 'active' AND product_type <> ?) ins_active_n,
            COALESCE(SUM(CASE WHEN status = 'active' AND product_type <> ? THEN premium END), 0) premium_in_force,
            COALESCE(SUM(CASE WHEN status = 'active' AND product_type = ? THEN premium END), 0) sip_monthly,
            SUM(status = 'lapsed') lapsed_n, SUM(status = 'matured') matured_n,
            SUM(start_date >= ?) s30, SUM(start_date >= ? AND start_date < ?) sp30
        FROM client_policies", [DASH_MF, DASH_MF, DASH_MF, $d30, $d60, $d30]);
    $policiesWeekly = dash_weekly($all(
        sprintf("SELECT $weekExpr k, COUNT(*) n FROM client_policies WHERE start_date >= ? AND start_date <= ? GROUP BY k", 'start_date'), [$t, $d84, $t]));

    // ---- claims --------------------------------------------------------
    $cl = $one("SELECT SUM(stage <> 'settled') open_n, SUM(notified_at >= ?) n30, SUM(notified_at >= ? AND notified_at < ?) p30 FROM claims", [$d30, $d60, $d30]);
    $claimsByStage = ['notified' => 0, 'documentation' => 0, 'insurer_liaison' => 0, 'settled' => 0];
    foreach ($all('SELECT stage, COUNT(*) n FROM claims GROUP BY stage') as $r) $claimsByStage[$r['stage']] = dash_int($r['n']);
    $claimsWeekly = dash_weekly($all(
        sprintf("SELECT $weekExpr k, COUNT(*) n FROM claims WHERE DATE(notified_at) >= ? GROUP BY k", 'notified_at'), [$t, $d84]));

    // ---- leads ---------------------------------------------------------
    $l = $one('SELECT COUNT(*) total, SUM(created_at >= ?) l30, SUM(created_at >= ? AND created_at < ?) p30 FROM leads', [$d30, $d60, $d30]);
    $leadsByStatus = ['new' => 0, 'contacted' => 0, 'qualified' => 0, 'converted' => 0, 'dropped' => 0];
    foreach ($all('SELECT status, COUNT(*) n FROM leads GROUP BY status') as $r) $leadsByStatus[$r['status']] = dash_int($r['n']);
    $leadsBySource = [];
    foreach ($all('SELECT source, COUNT(*) n FROM leads GROUP BY source ORDER BY n DESC') as $r) $leadsBySource[$r['source']] = dash_int($r['n']);
    $leadsByType = [];
    foreach ($all("SELECT COALESCE(lead_type, 'Other') lt, COUNT(*) n FROM leads GROUP BY lt ORDER BY n DESC") as $r) $leadsByType[$r['lt']] = dash_int($r['n']);
    $leadRows = $all(sprintf("SELECT $weekExpr k, COUNT(*) n, SUM(status = 'converted') conv FROM leads WHERE DATE(created_at) >= ? GROUP BY k", 'created_at'), [$t, $d84]);
    $leadsCreatedWeekly = dash_weekly($leadRows);
    $leadsConvertedWeekly = dash_weekly(array_map(fn ($r) => ['k' => $r['k'], 'n' => $r['conv']], $leadRows));

    // ---- segments (Life / Health / General / Mutual Funds) ---------------
    $segments = [];
    foreach ($all("SELECT COALESCE(pc.name, 'Other') name,
            COUNT(*) policies, COUNT(DISTINCT cp.client_id) clients,
            COALESCE(SUM(cp.premium), 0) premium, MAX(cp.product_type = ?) is_mf
        FROM client_policies cp LEFT JOIN product_categories pc ON pc.id = cp.category_id
        WHERE cp.status = 'active' GROUP BY name ORDER BY policies DESC", [DASH_MF]) as $r) {
        $segments[] = ['name' => $r['name'], 'policies' => dash_int($r['policies']), 'clients' => dash_int($r['clients']),
                       'premium' => dash_num($r['premium']), 'premium_kind' => dash_int($r['is_mf']) ? 'monthly_sip' : 'annual'];
    }

    // ---- new business, last 6 calendar months, by segment ----------------
    $months = [];
    for ($i = 5; $i >= 0; $i--) $months[$monthStart->modify("-$i months")->format('Y-m')] = [];
    foreach ($all("SELECT DATE_FORMAT(cp.start_date, '%Y-%m') ym, COALESCE(pc.name, 'Other') name, COUNT(*) n, COALESCE(SUM(cp.premium), 0) premium
        FROM client_policies cp LEFT JOIN product_categories pc ON pc.id = cp.category_id
        WHERE cp.start_date >= ? AND cp.start_date <= ? GROUP BY ym, name", [$firstNewBizMonth, $t]) as $r) {
        if (isset($months[$r['ym']])) $months[$r['ym']][$r['name']] = ['count' => dash_int($r['n']), 'premium' => dash_num($r['premium'])];
    }
    $newBusiness = [];
    foreach ($months as $ym => $bySeg) $newBusiness[] = ['month' => $ym, 'segments' => (object) $bySeg];

    // ---- renewals ------------------------------------------------------
    $renMonths = [];
    for ($i = 0; $i < 6; $i++) $renMonths[$monthStart->modify("+$i months")->format('Y-m')] = ['count' => 0, 'premium' => 0.0];
    foreach ($all("SELECT DATE_FORMAT(renewal_date, '%Y-%m') ym, COUNT(*) n, COALESCE(SUM(premium), 0) premium
        FROM client_policies WHERE status = 'active' AND product_type <> ? AND renewal_date >= ? AND renewal_date <= ? GROUP BY ym",
        [DASH_MF, $t, $renewalEnd]) as $r) {
        if (isset($renMonths[$r['ym']])) $renMonths[$r['ym']] = ['count' => dash_int($r['n']), 'premium' => dash_num($r['premium'])];
    }
    $renewalsByMonth = [];
    foreach ($renMonths as $ym => $v) $renewalsByMonth[] = ['month' => $ym] + $v;

    $upcoming = $all("SELECT cp.id, cp.product_type, cp.renewal_date, cp.premium, c.id client_id, c.full_name client_name
        FROM client_policies cp JOIN clients c ON c.id = cp.client_id
        WHERE cp.status = 'active' AND cp.product_type <> ? AND cp.renewal_date >= ? AND cp.renewal_date <= ?
        ORDER BY cp.renewal_date, c.full_name LIMIT 8", [DASH_MF, $t, $d60f]);
    $renewals60 = dash_int($one("SELECT COUNT(*) n FROM client_policies WHERE status = 'active' AND product_type <> ? AND renewal_date >= ? AND renewal_date <= ?", [DASH_MF, $t, $d60f])['n'] ?? 0);

    // ---- tasks ---------------------------------------------------------
    $tasksByStatus = ['todo' => 0, 'in_progress' => 0, 'done' => 0];
    foreach ($all('SELECT status, COUNT(*) n FROM tasks GROUP BY status') as $r) $tasksByStatus[$r['status']] = dash_int($r['n']);
    $tk = $one("SELECT SUM(status <> 'done' AND due_date < ?) overdue, SUM(status <> 'done' AND due_date = ?) due_today FROM tasks", [$t, $t]);

    // ---- top associates -------------------------------------------------
    $assoc = [];
    foreach ($all("SELECT u.id, u.full_name, COUNT(DISTINCT c.id) clients,
            COUNT(cp.id) policies, COALESCE(SUM(CASE WHEN cp.product_type <> ? THEN cp.premium END), 0) premium
        FROM users u
        LEFT JOIN clients c ON c.owner_id = u.id
        LEFT JOIN client_policies cp ON cp.client_id = c.id AND cp.status = 'active'
        WHERE u.role = 'associate' GROUP BY u.id, u.full_name", [DASH_MF]) as $r) {
        $assoc[$r['id']] = ['id' => $r['id'], 'name' => $r['full_name'] ?: 'Associate', 'clients' => dash_int($r['clients']),
                            'policies' => dash_int($r['policies']), 'premium' => dash_num($r['premium']), 'leads' => 0, 'converted' => 0];
    }
    foreach ($all("SELECT assigned_to id, COUNT(*) n, SUM(status = 'converted') conv FROM leads WHERE assigned_to IS NOT NULL GROUP BY assigned_to") as $r) {
        if (isset($assoc[$r['id']])) { $assoc[$r['id']]['leads'] = dash_int($r['n']); $assoc[$r['id']]['converted'] = dash_int($r['conv']); }
    }
    $topAssociates = array_values($assoc);
    usort($topAssociates, fn ($a, $b) => [$b['premium'], $b['policies']] <=> [$a['premium'], $a['policies']]);
    $topAssociates = array_slice($topAssociates, 0, 6);

    // ---- "Today" action list -----------------------------------------------
    $todayTasks = $all("SELECT id, title, due_date FROM tasks WHERE status <> 'done' AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date LIMIT 4", [$d7]);
    $todayRenewals = $all("SELECT cp.id, cp.product_type, cp.renewal_date, c.id client_id, c.full_name client_name
        FROM client_policies cp JOIN clients c ON c.id = cp.client_id
        WHERE cp.status = 'active' AND cp.product_type <> ? AND cp.renewal_date >= ? AND cp.renewal_date <= ? ORDER BY cp.renewal_date LIMIT 4", [DASH_MF, $t, $d7]);
    $todayLeads = $all("SELECT id, full_name, created_at FROM leads WHERE status = 'new' ORDER BY created_at LIMIT 4");

    $pct = fn (int $now, int $prev): ?float => $prev > 0 ? round(($now - $prev) / $prev * 100, 1) : null;
    $leadsTotal = dash_int($l['total']);

    return [
        'generated_at' => gmdate('c'),
        'today' => $t,
        'kpis' => [
            'clients' => ['value' => dash_int($c['total']), 'last_30d' => dash_int($c['c30']), 'change_pct' => $pct(dash_int($c['c30']), dash_int($c['p30'])), 'weekly' => $clientsWeekly],
            'active_policies' => ['value' => dash_int($p['active_n']), 'last_30d' => dash_int($p['s30']), 'change_pct' => $pct(dash_int($p['s30']), dash_int($p['sp30'])), 'weekly' => $policiesWeekly],
            'open_claims' => ['value' => dash_int($cl['open_n']), 'last_30d' => dash_int($cl['n30']), 'change_pct' => $pct(dash_int($cl['n30']), dash_int($cl['p30'])), 'weekly' => $claimsWeekly],
            'leads_30d' => ['value' => dash_int($l['l30']), 'last_30d' => dash_int($l['l30']), 'change_pct' => $pct(dash_int($l['l30']), dash_int($l['p30'])), 'weekly' => $leadsCreatedWeekly],
        ],
        'portfolio' => [
            'premium_in_force' => dash_num($p['premium_in_force']),
            'sip_monthly' => dash_num($p['sip_monthly']),
            'insurance_policies' => dash_int($p['ins_active_n']),
            'policy_status' => ['active' => dash_int($p['active_n']), 'lapsed' => dash_int($p['lapsed_n']), 'matured' => dash_int($p['matured_n'])],
            'segments' => $segments,
            'new_business' => $newBusiness,
        ],
        'leads' => [
            'total' => $leadsTotal,
            'conversion_pct' => $leadsTotal > 0 ? round($leadsByStatus['converted'] / $leadsTotal * 100, 1) : 0.0,
            'by_status' => $leadsByStatus,
            'by_source' => $leadsBySource,
            'by_type' => $leadsByType,
            'weekly_created' => $leadsCreatedWeekly,
            'weekly_converted' => $leadsConvertedWeekly,
        ],
        'claims' => ['by_stage' => $claimsByStage],
        'renewals' => ['by_month' => $renewalsByMonth, 'next_60d_count' => $renewals60, 'upcoming' => $upcoming],
        'tasks' => ['by_status' => $tasksByStatus, 'overdue' => dash_int($tk['overdue']), 'due_today' => dash_int($tk['due_today'])],
        'top_associates' => $topAssociates,
        'action_items' => ['tasks' => $todayTasks, 'renewals' => $todayRenewals, 'leads' => $todayLeads],
    ];
}
