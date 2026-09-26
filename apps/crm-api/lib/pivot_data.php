<?php
declare(strict_types=1);

// Pivot Explorer backend: group a fact (policies or leads) by any one or two
// dimensions and return every measure at once, so the browser can switch
// measures instantly without another request.
//
// Safety: dimensions are a fixed catalog of SQL *expressions* defined below —
// a request only ever names a catalog key, never supplies SQL. The one piece of
// user input that reaches the query, filter values, is always bound as a
// parameter. Unknown keys are rejected with 422.
//
// Money: policy `premium` is an ANNUAL premium for insurance products and a
// MONTHLY SIP amount for Mutual Funds. They are separate measures and never
// summed into one number.

const PIVOT_MAX_ROWS = 80;
const PIVOT_MAX_COLS = 24;
const PIVOT_MAX_FILTER_VALUES = 200;
const PIVOT_RECORD_LIMIT = 25;

function pivot_catalog(): array
{
    $policyMeasures = "COUNT(*) AS n,
        COUNT(DISTINCT cp.client_id) AS clients,
        COALESCE(SUM(CASE WHEN cp.product_type <> 'Mutual Fund' THEN cp.premium END), 0) AS annual_premium,
        COALESCE(SUM(CASE WHEN cp.product_type = 'Mutual Fund' THEN cp.premium END), 0) AS sip_monthly,
        COALESCE(SUM(cp.sum_assured), 0) AS sum_assured";
    $leadMeasures = "COUNT(*) AS n,
        COALESCE(SUM(l.status = 'converted'), 0) AS converted,
        COALESCE(SUM(l.status = 'dropped'), 0) AS dropped,
        COALESCE(SUM(l.status = 'new'), 0) AS untouched";

    return [
        'policies' => [
            'label' => 'Policies',
            'from' => 'client_policies cp
                JOIN clients c ON c.id = cp.client_id
                LEFT JOIN product_categories pc ON pc.id = cp.category_id
                LEFT JOIN users u ON u.id = c.owner_id',
            'measures_sql' => $policyMeasures,
            'dims' => [
                'segment' => ['label' => 'Business line', 'sql' => "COALESCE(pc.name, 'Other')"],
                'product' => ['label' => 'Product', 'sql' => 'cp.product_type'],
                'insurer' => ['label' => 'Insurer / AMC', 'sql' => 'cp.insurer'],
                'associate' => ['label' => 'Associate', 'sql' => "COALESCE(u.full_name, 'Unassigned')"],
                'city' => ['label' => 'City', 'sql' => "COALESCE(NULLIF(c.city, ''), 'Unknown')"],
                'status' => ['label' => 'Policy status', 'sql' => 'cp.status'],
                'start_month' => ['label' => 'Start month', 'sql' => "COALESCE(DATE_FORMAT(cp.start_date, '%Y-%m'), 'Unknown')", 'order' => 'key', 'time' => true],
                'start_year' => ['label' => 'Start year', 'sql' => "COALESCE(CAST(YEAR(cp.start_date) AS CHAR), 'Unknown')", 'order' => 'key', 'time' => true],
                'renewal_month' => ['label' => 'Renewal month', 'sql' => "COALESCE(DATE_FORMAT(cp.renewal_date, '%Y-%m'), 'Unknown')", 'order' => 'key', 'time' => true],
            ],
            'measures' => [
                ['key' => 'n', 'label' => 'Policies', 'format' => 'int'],
                ['key' => 'clients', 'label' => 'Clients', 'format' => 'int'],
                ['key' => 'annual_premium', 'label' => 'Annual premium (insurance)', 'format' => 'inr'],
                ['key' => 'sip_monthly', 'label' => 'Monthly SIP (Mutual Funds)', 'format' => 'inr'],
                ['key' => 'sum_assured', 'label' => 'Sum assured', 'format' => 'inr'],
            ],
            'record_select' => 'cp.id AS id, c.id AS client_id, c.full_name AS title, cp.product_type AS line1, cp.insurer AS line2, cp.premium AS amount, cp.status AS badge, cp.renewal_date AS date',
            'record_order' => 'cp.premium DESC, cp.id',
        ],
        'leads' => [
            'label' => 'Leads',
            'from' => 'leads l LEFT JOIN users u ON u.id = l.assigned_to',
            'measures_sql' => $leadMeasures,
            'dims' => [
                'source' => ['label' => 'Source', 'sql' => 'l.source'],
                'lead_type' => ['label' => 'Lead type', 'sql' => "COALESCE(l.lead_type, 'Other')"],
                'status' => ['label' => 'Status', 'sql' => 'l.status'],
                'associate' => ['label' => 'Assigned associate', 'sql' => "COALESCE(u.full_name, 'Unassigned')"],
                'city' => ['label' => 'City', 'sql' => "COALESCE(NULLIF(l.city, ''), 'Unknown')"],
                'created_month' => ['label' => 'Created month', 'sql' => "COALESCE(DATE_FORMAT(l.created_at, '%Y-%m'), 'Unknown')", 'order' => 'key', 'time' => true],
                'created_year' => ['label' => 'Created year', 'sql' => "COALESCE(CAST(YEAR(l.created_at) AS CHAR), 'Unknown')", 'order' => 'key', 'time' => true],
            ],
            'measures' => [
                ['key' => 'n', 'label' => 'Leads', 'format' => 'int'],
                ['key' => 'converted', 'label' => 'Converted', 'format' => 'int'],
                ['key' => 'conversion_pct', 'label' => 'Conversion rate', 'format' => 'pct', 'ratio' => ['converted', 'n']],
                ['key' => 'dropped', 'label' => 'Dropped', 'format' => 'int'],
                ['key' => 'untouched', 'label' => 'Untouched (new)', 'format' => 'int'],
            ],
            'record_select' => 'l.id AS id, NULL AS client_id, l.full_name AS title, l.phone AS line1, CONCAT_WS(" · ", l.source, l.lead_type) AS line2, NULL AS amount, l.status AS badge, DATE(l.created_at) AS date',
            'record_order' => 'l.created_at DESC, l.id',
        ],
    ];
}

/** What the browser needs to draw the controls — never any SQL. */
function pivot_meta(): array
{
    $out = [];
    foreach (pivot_catalog() as $fact => $def) {
        $dims = [];
        foreach ($def['dims'] as $key => $d) $dims[] = ['key' => $key, 'label' => $d['label'], 'time' => !empty($d['time'])];
        $out[$fact] = ['label' => $def['label'], 'dims' => $dims, 'measures' => $def['measures']];
    }
    return $out;
}

function pivot_def(string $fact): array
{
    $cat = pivot_catalog();
    if (!isset($cat[$fact])) json_error('Unknown data set', 422);
    return $cat[$fact];
}

function pivot_dim(array $def, ?string $key, bool $required): ?array
{
    if ($key === null || $key === '') {
        if ($required) json_error('A rows dimension is required', 422);
        return null;
    }
    if (!isset($def['dims'][$key])) json_error("Unknown dimension: $key", 422);
    return $def['dims'][$key];
}

/** Builds " WHERE (expr IN (?,?)) AND …" and appends the bound values to $params. */
function pivot_where(array $def, array $filters, array &$params): string
{
    $parts = [];
    foreach ($filters as $dim => $values) {
        if (!is_string($dim) || !isset($def['dims'][$dim])) json_error("Unknown filter dimension: " . (is_string($dim) ? $dim : '?'), 422);
        if (!is_array($values) || !$values) continue;
        $values = array_slice(array_map('strval', array_values($values)), 0, PIVOT_MAX_FILTER_VALUES);
        $parts[] = '(' . $def['dims'][$dim]['sql'] . ' IN (' . implode(',', array_fill(0, count($values), '?')) . '))';
        foreach ($values as $v) $params[] = $v;
    }
    return $parts ? ' WHERE ' . implode(' AND ', $parts) : '';
}

/** Numeric strings from PDO → int/float so JSON carries real numbers. */
function pivot_numbers(array $row): array
{
    foreach ($row as $k => $v) {
        if ($k === 'pv_r' || $k === 'pv_c') { $row[$k] = (string) $v; continue; }
        if (is_numeric($v)) $row[$k] = $v + 0;
    }
    return $row;
}

function pivot_fetch(PDO $db, string $sql, array $params): array
{
    $s = $db->prepare($sql);
    $s->execute($params);
    return array_map('pivot_numbers', $s->fetchAll());
}

/** Order keys: chronological/alphabetical for time-like dims, else biggest first; "Unknown" always last. */
function pivot_order_keys(array $totalsByKey, array $dim): array
{
    // PHP turns numeric-looking array keys (years) into ints; keep every key a string end to end.
    $keys = array_map("strval", array_keys($totalsByKey));
    if (($dim['order'] ?? '') === 'key') {
        usort($keys, fn ($a, $b) => ($a === 'Unknown') <=> ($b === 'Unknown') ?: strcmp((string) $a, (string) $b));
    } else {
        usort($keys, fn ($a, $b) => ($a === 'Unknown') <=> ($b === 'Unknown') ?: ($totalsByKey[$b]['n'] <=> $totalsByKey[$a]['n']) ?: strcmp((string) $a, (string) $b));
    }
    return $keys;
}

function pivot_run(PDO $db, string $fact, string $rowsKey, ?string $colsKey, array $filters): array
{
    $def = pivot_def($fact);
    $rowDim = pivot_dim($def, $rowsKey, true);
    $colDim = pivot_dim($def, $colsKey, false);

    $params = [];
    $where = pivot_where($def, $filters, $params);
    $from = $def['from'];
    $measures = $def['measures_sql'];
    $rExpr = $rowDim['sql'];
    $cExpr = $colDim ? $colDim['sql'] : "'All'";

    $cells = pivot_fetch($db, "SELECT $rExpr AS pv_r, $cExpr AS pv_c, $measures FROM $from$where GROUP BY pv_r, pv_c", $params);
    $rowTotalsRaw = pivot_fetch($db, "SELECT $rExpr AS pv_r, $measures FROM $from$where GROUP BY pv_r", $params);
    $colTotalsRaw = $colDim ? pivot_fetch($db, "SELECT $cExpr AS pv_c, $measures FROM $from$where GROUP BY pv_c", $params) : [];
    $grand = pivot_fetch($db, "SELECT $measures FROM $from$where", $params)[0] ?? [];

    $rowTotals = [];
    foreach ($rowTotalsRaw as $r) { $k = $r['pv_r']; unset($r['pv_r']); $rowTotals[$k] = $r; }
    $colTotals = [];
    foreach ($colTotalsRaw as $r) { $k = $r['pv_c']; unset($r['pv_c']); $colTotals[$k] = $r; }

    $allRowKeys = pivot_order_keys($rowTotals, $rowDim);
    $allColKeys = $colDim ? pivot_order_keys($colTotals, $colDim) : ['All'];
    $rowKeys = array_slice($allRowKeys, 0, PIVOT_MAX_ROWS);
    $colKeys = array_slice($allColKeys, 0, PIVOT_MAX_COLS);
    $rowSet = array_flip($rowKeys);
    $colSet = array_flip($colKeys);

    $outCells = [];
    foreach ($cells as $c) {
        if (isset($rowSet[$c['pv_r']]) && isset($colSet[$c['pv_c']])) {
            $outCells[] = ['r' => $c['pv_r'], 'c' => $c['pv_c']] + array_diff_key($c, ['pv_r' => 1, 'pv_c' => 1]);
        }
    }

    return [
        'fact' => $fact,
        'rows' => $rowsKey,
        'cols' => $colDim ? $colsKey : null,
        'row_keys' => $rowKeys,
        'col_keys' => $colKeys,
        'cells' => $outCells,
        'row_totals' => (object) array_intersect_key($rowTotals, $rowSet),
        'col_totals' => (object) ($colDim ? array_intersect_key($colTotals, $colSet) : []),
        'grand' => $grand,
        'truncated' => [
            'rows' => count($allRowKeys) > count($rowKeys),
            'cols' => count($allColKeys) > count($colKeys),
            'row_count' => count($allRowKeys),
            'col_count' => count($allColKeys),
        ],
        'generated_at' => gmdate('c'),
    ];
}

/** Distinct values (with counts) of one dimension, for the filter picker. */
function pivot_values(PDO $db, string $fact, string $dimKey): array
{
    $def = pivot_def($fact);
    $dim = pivot_dim($def, $dimKey, true);
    $rows = pivot_fetch($db, 'SELECT ' . $dim['sql'] . ' AS pv_r, COUNT(*) AS n FROM ' . $def['from'] . ' GROUP BY pv_r ORDER BY n DESC LIMIT ' . PIVOT_MAX_FILTER_VALUES, []);
    return array_map(fn ($r) => ['value' => $r['pv_r'], 'count' => $r['n']], $rows);
}

/** Drill-through: the actual records behind a cell (or any filtered slice). */
function pivot_records(PDO $db, string $fact, array $filters): array
{
    $def = pivot_def($fact);
    $params = [];
    $where = pivot_where($def, $filters, $params);
    $total = (int) (pivot_fetch($db, 'SELECT COUNT(*) AS n FROM ' . $def['from'] . $where, $params)[0]['n'] ?? 0);
    $rows = pivot_fetch(
        $db,
        'SELECT ' . $def['record_select'] . ' FROM ' . $def['from'] . $where . ' ORDER BY ' . $def['record_order'] . ' LIMIT ' . PIVOT_RECORD_LIMIT,
        $params
    );
    return ['total' => $total, 'shown' => count($rows), 'records' => $rows];
}
