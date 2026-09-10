<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';

// Mirrors CalculatorDefaultsCard.tsx (admin write) and the SEPARATE static
// marketing site's calculators.js (public read — no session, no CORS
// issue since it's the same host). RLS this replaces (0004_crm_core.sql):
// PUBLIC read (using (true)), admin-only write. Singleton row (id=1).

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Deliberately no require_login() here — this is the one endpoint the
    // public website calls unauthenticated.
    $row = db()->query(
        'SELECT self_consumption_pct, income_growth_pct, discount_rate_pct, edu_inflation_pct, edu_return_pct,
                sip_return_pct, retirement_inflation_pct, pre_retirement_return_pct, post_retirement_return_pct,
                default_retirement_age, default_life_expectancy
         FROM calculator_config WHERE id = 1'
    )->fetch();
    json_out($row ?: null);
}

if ($method === 'PUT') {
    require_role('admin');
    $body = json_input();
    $cols = [
        'self_consumption_pct', 'income_growth_pct', 'discount_rate_pct', 'edu_inflation_pct', 'edu_return_pct',
        'sip_return_pct', 'retirement_inflation_pct', 'pre_retirement_return_pct', 'post_retirement_return_pct',
        'default_retirement_age', 'default_life_expectancy',
    ];
    $fields = [];
    $params = [];
    foreach ($cols as $col) {
        if (array_key_exists($col, $body)) {
            $fields[] = "$col = ?";
            $params[] = $body[$col];
        }
    }
    if (!$fields) json_error('No fields to update', 422);
    db()->prepare('UPDATE calculator_config SET ' . implode(', ', $fields) . ' WHERE id = 1')->execute($params);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
