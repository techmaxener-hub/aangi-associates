<?php
declare(strict_types=1);
require __DIR__ . '/_common.php';

// Demo/test data for the Aangi CRM: 921 leads, 522 clients across Life /
// General / Health / Mutual Funds, 5 staff + 50 associate logins, plus
// enough supporting rows (policies, opportunities, claims, communications,
// tasks, candidates, calls, business plans) to exercise every screen.
//
//   php apps/crm-api/demo/seed_demo.php
//
// Every row id starts with DEMO_PREFIX so flush_demo.php can remove exactly
// this data later. Credentials are written to demo/DEMO_CREDENTIALS.csv
// (gitignored). Phone numbers deliberately start with 5 — not a valid
// Indian mobile range — so no real person can be messaged by a WhatsApp
// click-to-chat or renewal reminder fired from demo data. Edit one record's
// phone to your own number when you want to test messaging end to end.

mt_srand(20260926); // reproducible dataset
$db = demo_db();
$today = new DateTimeImmutable('2026-09-26', new DateTimeZone('UTC'));

$exists = $db->prepare('SELECT COUNT(*) FROM users WHERE id LIKE ?');
$exists->execute([DEMO_PREFIX . '%']);
if ((int) $exists->fetchColumn() > 0) { fwrite(STDERR, "Demo data already present — run flush_demo.php --yes first.\n"); exit(1); }

// ---------- helpers ----------
function pick(array $a) { return $a[mt_rand(0, count($a) - 1)]; }
function weighted(array $w) { $t = array_sum($w); $r = mt_rand(1, $t); foreach ($w as $k => $v) { if (($r -= $v) <= 0) return $k; } return array_key_last($w); }
function between(int $a, int $b, int $step = 1): int { return $a + mt_rand(0, intdiv($b - $a, $step)) * $step; }
function dt(DateTimeImmutable $d): string { return $d->format('Y-m-d H:i:s'); }
function daysAgo(DateTimeImmutable $t, int $n, int $extraSecs = 0): DateTimeImmutable { return $t->modify("-$n days")->modify("+$extraSecs seconds"); }
function insert_many(PDO $db, string $table, array $cols, array $rows): void
{
    foreach (array_chunk($rows, 150) as $chunk) {
        $one = '(' . implode(',', array_fill(0, count($cols), '?')) . ')';
        $sql = "INSERT INTO $table (" . implode(',', $cols) . ') VALUES ' . implode(',', array_fill(0, count($chunk), $one));
        $db->prepare($sql)->execute(array_merge(...array_map('array_values', $chunk)));
    }
}
$usedPhones = [];
function phone(): string { global $usedPhones; do { $p = '5' . str_pad((string) mt_rand(0, 999999999), 9, '0', STR_PAD_LEFT); } while (isset($usedPhones[$p])); $usedPhones[$p] = true; return $p; }

$male = ['Rajesh','Amit','Hitesh','Nilesh','Kunal','Dhruv','Jignesh','Paresh','Mihir','Chirag','Bhavin','Kalpesh','Sanjay','Vivek','Harsh','Yash','Manan','Tejas','Ketan','Rohan','Pratik','Nirav','Darshan','Ankit','Dipak','Mayur','Jaimin','Sagar','Umesh','Viral'];
$female = ['Priya','Neha','Komal','Hetal','Pooja','Riddhi','Bhumika','Krupa','Dhara','Nidhi','Kinjal','Mitali','Sonal','Ritu','Zalak','Jinal','Foram','Purvi','Sejal','Trupti','Anjali','Khyati','Payal','Rupal','Hiral','Swati','Mansi','Vidhi','Disha','Nandini'];
$surnames = ['Shah','Patel','Mehta','Desai','Joshi','Trivedi','Parikh','Modi','Gandhi','Thakkar','Vyas','Pandya','Bhatt','Chauhan','Solanki','Rathod','Jain','Agarwal','Sharma','Dave','Kapadia','Doshi','Amin','Vora','Zaveri','Raval','Soni','Panchal','Prajapati','Kothari'];
$cities = ['Ahmedabad','Ahmedabad','Ahmedabad','Gandhinagar','Surat','Vadodara','Rajkot','Mandvi','Bhavnagar','Anand','Mehsana','Nadiad','Bharuch','Morbi','Jamnagar'];
$fullName = fn () => (mt_rand(0, 1) ? pick($male) : pick($female)) . ' ' . pick($surnames);

// ---------- users: 5 staff + 50 associates ----------
$adj = ['Amber','Brisk','Calm','Dusty','Eager','Fancy','Gentle','Happy','Ivory','Jolly','Keen','Lucky','Maple','Noble','Olive','Proud','Quiet','Royal','Sunny','Tidy'];
$noun = ['Falcon','Tiger','Lotus','River','Cedar','Comet','Harbor','Meadow','Otter','Pebble','Rocket','Summit','Thunder','Willow','Zephyr'];
$password = fn () => pick($adj) . '-' . pick($noun) . '-' . mt_rand(1000, 9999);

$staffNames = ['Ketaki Vaidya', 'Rahul Bhavsar', 'Mona Chaudhari', 'Arjun Nair', 'Simran Kaur'];
$users = []; $creds = []; $staffIds = []; $assocIds = [];
$mkUser = function (string $role, int $n, string $name) use (&$users, &$creds, $password) {
    $id = demo_id(); $pw = $password();
    $email = sprintf('demo.%s%02d@aangi-demo.test', $role, $n);
    $users[] = [$id, $email, phone(), password_hash($pw, PASSWORD_BCRYPT), $role, $name, dt(new DateTimeImmutable('2026-08-01'))];
    $creds[] = [$role, $name, $email, $pw];
    return $id;
};
foreach ($staffNames as $i => $n) $staffIds[] = $mkUser('staff', $i + 1, $n);
$usedNames = [];
for ($i = 1; $i <= 50; $i++) { do { $n = $fullName(); } while (isset($usedNames[$n])); $usedNames[$n] = 1; $assocIds[] = $mkUser('associate', $i, $n); }
$assocName = array_column($users, 5, 0);

// ---------- categories + admin ----------
$cat = array_column($db->query('SELECT id, name FROM product_categories')->fetchAll(), 'id', 'name');
foreach (['Life Insurance', 'General Insurance', 'Health Insurance', 'Mutual Funds'] as $n) if (!isset($cat[$n])) { fwrite(STDERR, "Missing product category $n — run seed.sql first.\n"); exit(1); }
$adminId = $db->query("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1")->fetchColumn() ?: null;

// ---------- clients: 522 (Life 178, Health 136, General 104, MF 104 primary) ----------
$segs = array_merge(array_fill(0, 178, 'life'), array_fill(0, 136, 'health'), array_fill(0, 104, 'general'), array_fill(0, 104, 'mf'));
shuffle($segs);
$segCat = ['life' => 'Life Insurance', 'health' => 'Health Insurance', 'general' => 'General Insurance', 'mf' => 'Mutual Funds'];
$clients = []; $clientRows = []; $emailN = 0;
foreach ($segs as $i => $seg) {
    $id = demo_id(); $name = $fullName(); [$first, $last] = explode(' ', $name);
    $owner = mt_rand(1, 100) <= 94 ? pick($assocIds) : null; // 6% unowned, to test assignment
    $created = daysAgo($today, mt_rand(5, 900), mt_rand(0, 86399));
    $email = mt_rand(1, 100) <= 75 ? strtolower("$first.$last" . (++$emailN) . '@example.com') : null;
    $hh = mt_rand(1, 100) <= 55 ? "$last Family" : null;
    $clients[] = ['id' => $id, 'name' => $name, 'phone' => phone(), 'city' => pick($cities), 'owner' => $owner, 'seg' => $seg, 'created' => $created, 'email' => $email];
    $c = end($clients);
    $clientRows[] = [$id, $name, $c['phone'], $email, $c['city'], $hh, $owner, dt($created)];
}

// ---------- policies ----------
$products = [
  'life' => [['Pure Term Plan', 40, 5000000, 25000000, 500000, 7000, 40000, 'TATA AIA'], ['Child Education Plan', 15, 2500000, 10000000, 500000, 40000, 150000, 'TATA AIA'],
             ['Guaranteed Return Plan', 25, 1000000, 5000000, 500000, 50000, 300000, 'TATA AIA'], ['Pension/Annuity', 12, 1000000, 3000000, 500000, 50000, 200000, 'TATA AIA'],
             ['Keyman Insurance', 8, 10000000, 50000000, 5000000, 80000, 500000, 'TATA AIA']],
  'health' => [['Family Mediclaim', 60, 500000, 2500000, 500000, 12000, 45000, null], ['Critical Illness Cover', 25, 1000000, 5000000, 500000, 8000, 35000, null], ['Group Health Cover', 15, 300000, 1000000, 100000, 60000, 400000, null]],
  'general' => [['General Insurance', 100, 500000, 10000000, 250000, 3000, 60000, null]],
  'mf' => [['Mutual Fund', 100, 0, 0, 1, 2000, 50000, null]],
];
$insurers = ['health' => ['Niva Bupa', 'Care Health', 'HDFC ERGO', 'Star Health', 'TATA AIG'], 'general' => ['TATA AIG', 'ICICI Lombard', 'Bajaj Allianz', 'New India Assurance', 'HDFC ERGO'],
             'mf' => ['HDFC Mutual Fund', 'SBI Mutual Fund', 'Axis Mutual Fund', 'ICICI Prudential MF', 'Nippon India MF', 'Kotak Mutual Fund']];
$policies = []; $policyRows = []; $policiesByClient = [];
$mkPolicy = function (array $c, string $seg) use (&$policyRows, &$policies, &$policiesByClient, $products, $insurers, $cat, $segCat, $today) {
    $w = []; foreach ($products[$seg] as $k => $p) $w[$k] = $p[1];
    [$ptype, , $saMin, $saMax, $saStep, $pMin, $pMax, $fixedInsurer] = $products[$seg][weighted($w)];
    $insurer = $fixedInsurer ?? pick($insurers[$seg]);
    // 30% of policies start in the last 90 days so Business Planning has live achievement to show.
    $startAgo = mt_rand(1, 100) <= 30 ? mt_rand(0, 90) : mt_rand(91, 1000);
    $start = $today->modify("-$startAgo days");
    $premium = $seg === 'mf' ? between(2000, 50000, 500) : between($pMin, $pMax, 500);
    $sa = $seg === 'mf' ? null : between($saMin, $saMax, $saStep);
    $status = 'active'; $renewal = null;
    if ($seg !== 'mf') {
        $renewal = $start; while ($renewal < $today->modify('-25 days')) $renewal = $renewal->modify('+1 year');
        $r = mt_rand(1, 100);
        if ($r <= 6) { $status = 'lapsed'; $renewal = $start->modify('+1 year'); if ($renewal >= $today) $renewal = $today->modify('-' . mt_rand(10, 120) . ' days'); }
        elseif ($r <= 9 && in_array($ptype, ['Guaranteed Return Plan', 'Pension/Annuity', 'Child Education Plan'], true)) { $status = 'matured'; $renewal = null; }
    }
    $prefix = ['life' => 'TA', 'health' => 'HL', 'general' => 'GN', 'mf' => 'FOLIO'][$seg];
    $id = demo_id();
    $row = [$id, $c['id'], $prefix . mt_rand(10000000, 99999999), $insurer, $ptype, $sa, $premium, $start->format('Y-m-d'), $renewal?->format('Y-m-d'), $status, $cat[$segCat[$seg]], dt($start->modify('+' . mt_rand(0, 40000) . ' seconds'))];
    $policyRows[] = $row;
    $policies[] = ['id' => $id, 'client' => $c['id'], 'seg' => $seg, 'type' => $ptype, 'start' => $start];
    $policiesByClient[$c['id']][] = end($policies);
};
foreach ($clients as $c) {
    $mkPolicy($c, $c['seg']);
    $extra = weighted([0 => 55, 1 => 30, 2 => 15]);
    for ($k = 0; $k < $extra; $k++) $mkPolicy($c, pick(['life', 'health', 'general', 'mf']));
}
usort($policyRows, fn ($a, $b) => strcmp($a[11], $b[11]));

// ---------- leads: 921 ----------
$sources = ['manual' => 14, 'bulk_upload' => 10, 'meta' => 18, 'google_ads' => 14, 'indiamart' => 6, 'justdial' => 10, 'tradeindia' => 3, 'whatsapp' => 12, 'linkedin' => 4, 'sulekha' => 3, 'policybazaar' => 4, 'investwell' => 2];
$leadTypes = ['Term' => 30, 'Mediclaim' => 28, 'Mutual Funds' => 22, 'Keyman' => 8, 'Agent Recruitment' => 12];
$segLead = ['life' => 'Term', 'health' => 'Mediclaim', 'general' => 'Mediclaim', 'mf' => 'Mutual Funds'];
$notes = ['Asked for a callback after 6 pm.', 'Comparing with existing LIC policy.', 'Interested in family floater, 2 adults + 1 child.', 'Wants SIP starting at 10k/month.', 'Referred by an existing client.',
          'Salaried, no cover currently.', 'Business owner — needs keyman + group health.', 'Already has term cover, wants top-up.', 'Requested brochure on WhatsApp.', 'Not reachable on first attempt.', null, null, null];
$leadRows = [];
$mkLead = function (string $status, ?array $client = null) use (&$leadRows, $sources, $leadTypes, $segLead, $today, $staffIds, $assocIds, $fullName, $cities, $notes, $assocName) {
    $created = daysAgo($today, mt_rand(0, 150), mt_rand(0, 86399));
    if ($created > $today) $created = $today;
    $span = max(0, $today->getTimestamp() - $created->getTimestamp());
    $updated = $status === 'new' ? $created : $created->modify('+' . mt_rand(3600, max(3601, min($span, 86400 * 20))) . ' seconds');
    $name = $client['name'] ?? $fullName();
    $assigned = null;
    if ($client) $assigned = $client['owner'];
    elseif ($status !== 'new' || mt_rand(1, 100) <= 25) $assigned = mt_rand(1, 100) <= 85 ? pick($assocIds) : pick($staffIds);
    $type = $client ? $segLead[$client['seg']] : weighted($leadTypes);
    $email = $client['email'] ?? (mt_rand(1, 100) <= 60 ? strtolower(str_replace(' ', '.', $name)) . mt_rand(1, 99) . '@example.com' : null);
    $leadRows[] = [demo_id(), $name, $client['phone'] ?? phone(), $email, $client['city'] ?? pick($cities), $type, weighted($sources),
                   $assigned ? $assocName[$assigned] ?? null : null, pick($notes), $status, dt($created), $client ? null : null, $client['id'] ?? null, dt($updated), $assigned];
};
$convertedClients = array_slice($clients, 0, 0);
$shuffled = $clients; shuffle($shuffled);
foreach (array_slice($shuffled, 0, 101) as $c) $mkLead('converted', $c);
foreach (['new' => 300, 'contacted' => 240, 'qualified' => 170, 'dropped' => 110] as $st => $n) for ($i = 0; $i < $n; $i++) $mkLead($st);
shuffle($leadRows);

// ---------- opportunities / claims / communications ----------
$oppTypes = ['Pure Term Plan','Critical Illness Cover','Family Mediclaim','Child Education Plan','Guaranteed Return Plan','Mutual Fund','Pension/Annuity','Keyman Insurance','Group Health Cover','General Insurance'];
$oppRows = [];
foreach (array_slice($clients, 0, 210) as $c) {
    $created = daysAgo($today, mt_rand(0, 120), mt_rand(0, 86399));
    $stage = weighted(['inquiry' => 30, 'quote' => 25, 'application' => 18, 'underwriting' => 12, 'bind_issue' => 15]);
    $oppRows[] = [demo_id(), $c['id'], pick($oppTypes), $stage, $c['owner'], dt($created), dt($created->modify('+' . mt_rand(0, 15) . ' days'))];
}
$claimRows = []; $claimNotes = ['Hospitalisation — cashless request raised.', 'Reimbursement claim, bills submitted.', 'Death claim — nominee documents pending.', 'Motor own-damage claim, surveyor assigned.', 'Maturity/benefit payout query.', 'Critical illness diagnosis reports awaiting insurer review.'];
$claimClients = array_filter($clients, fn ($c) => !empty($policiesByClient[$c['id']]) && $c['seg'] !== 'mf');
shuffle($claimClients);
foreach (array_slice($claimClients, 0, 26) as $c) {
    $stage = weighted(['notified' => 6, 'documentation' => 7, 'insurer_liaison' => 6, 'settled' => 6]);
    $pol = pick(array_values(array_filter($policiesByClient[$c['id']], fn ($p) => $p['seg'] !== 'mf')) ?: $policiesByClient[$c['id']]);
    $notified = daysAgo($today, mt_rand(2, 140), mt_rand(0, 86399));
    $settled = $stage === 'settled' ? $notified->modify('+' . mt_rand(5, 45) . ' days') : null;
    if ($settled && $settled > $today) $settled = $today;
    $claimRows[] = [demo_id(), $c['id'], $pol['id'], $stage, dt($notified), $settled ? dt($settled) : null, pick($claimNotes), dt($notified)];
}
$commNotes = ['Shared policy illustration on WhatsApp.', 'Called to explain premium due date.', 'Client asked to revisit next month.', 'Sent renewal reminder and payment link.', 'Discussed adding a child plan.', 'Emailed KYC checklist.', 'Anniversary greeting sent.', 'Follow-up on claim documents.'];
$commRows = [];
foreach ($clients as $c) {
    if (mt_rand(1, 100) > 42) continue;
    for ($k = mt_rand(1, 3); $k > 0; $k--) {
        $at = daysAgo($today, mt_rand(0, 90), mt_rand(0, 86399));
        $commRows[] = [demo_id(), $c['id'], pick(['whatsapp', 'whatsapp', 'call', 'call', 'email', 'other']), pick($commNotes), dt($at), $c['owner'] ?? pick($staffIds), dt($at)];
    }
}

// ---------- candidates (onboarding) ----------
$assocStages = ['application','documentation','training','exam','code_issued','days_1_30','days_31_60','days_61_90','active_associate'];
$staffStages = ['offer','documentation','system_access','week_1_training','active_staff'];
$occ = ['Bank employee','Teacher','Retired executive','Homemaker','Small business owner','Chartered accountant','Sales manager','Freelancer','Engineer','Real-estate broker'];
$candRows = []; $candIds = [];
for ($i = 0; $i < 44; $i++) {
    $track = mt_rand(1, 100) <= 78 ? 'associate' : 'staff'; $stages = $track === 'associate' ? $assocStages : $staffStages; $id = demo_id(); $candIds[] = $id;
    $candRows[] = [$id, $fullName(), phone(), mt_rand(1, 100) <= 70 ? 'candidate' . ($i + 1) . '@example.com' : null, pick($cities), pick($occ), $track, pick($stages), pick(['manual', 'website', 'referral', 'linkedin', 'bulk_upload']), null, dt(daysAgo($today, mt_rand(0, 100), mt_rand(0, 86399)))];
}

// ---------- tasks ----------
$taskTitles = ['Call to confirm renewal payment', 'Collect KYC documents', 'Send policy illustration', 'Follow up on pending medical test', 'Schedule financial-planning meeting', 'Verify nominee details', 'Share claim status update', 'Onboarding call with new associate', 'Prepare quote for family floater', 'Renewal reminder — 30-day milestone'];
$taskRows = [];
for ($i = 0; $i < 170; $i++) {
    $assignee = mt_rand(1, 100) <= 75 ? pick($assocIds) : pick($staffIds);
    $ownedClients = array_values(array_filter($clients, fn ($c) => $c['owner'] === $assignee));
    $link = null; $cand = null;
    $r = mt_rand(1, 100);
    if ($r <= 55 && $ownedClients) $link = pick($ownedClients)['id'];
    elseif ($r <= 70) $cand = pick($candIds);
    $due = $today->modify(mt_rand(-20, 30) . ' days');
    $status = $due < $today ? weighted(['done' => 60, 'in_progress' => 15, 'todo' => 25]) : weighted(['todo' => 60, 'in_progress' => 30, 'done' => 10]);
    $taskRows[] = [demo_id(), pick($taskTitles), null, $assignee, $due->format('Y-m-d'), $status, $link, $cand, $adminId ?: pick($staffIds), dt(daysAgo($today, mt_rand(0, 40), mt_rand(0, 86399)))];
}

// ---------- calls ----------
$callRows = [];
for ($i = 0; $i < 64; $i++) {
    $status = weighted(['completed' => 60, 'missed' => 18, 'voicemail' => 8, 'logged' => 14]); $done = $status === 'completed';
    $callRows[] = [demo_id(), $fullName(), phone(), pick(['meta', 'google_ads', 'justdial', 'whatsapp', 'indiamart', 'manual']), pick(['Gujarati', 'Hindi', 'English']),
                   pick(['inbound', 'outbound']), $done ? mt_rand(45, 780) : null, $done ? pick(['high', 'medium', 'medium', 'low']) : null, $status,
                   $done ? pick(['Wants term quote for 1 Cr.', 'Asked about mediclaim for parents.', 'Interested in SIP — call back Sunday.', 'Existing client, renewal query.']) : null,
                   pick($staffIds), dt(daysAgo($today, mt_rand(0, 45), mt_rand(0, 86399)))];
}

// ---------- business plans: current month for 14 associates + Q3 for 6 ----------
$planRows = []; $targetRows = [];
foreach (array_slice($assocIds, 0, 14) as $i => $aid) {
    $isQuarter = $i >= 8;
    $pid = demo_id();
    $planRows[] = [$pid, $aid, $isQuarter ? 'quarter' : 'month', $isQuarter ? 'Q3 FY26-27 (Jul–Sep 2026)' : 'September 2026', $isQuarter ? '2026-07-01' : '2026-09-01', '2026-09-30', 'Demo target set for testing.', $adminId, '2026-08-25 10:00:00', '2026-08-25 10:00:00'];
    foreach (['Life Insurance', 'Health Insurance', 'General Insurance', 'Mutual Funds'] as $cn) {
        $prem = between(50000, 400000, 10000) * ($isQuarter ? 3 : 1);
        $targetRows[] = [demo_id(), $pid, $cat[$cn], $prem, between(3, 15) * ($isQuarter ? 3 : 1), $cn === 'Mutual Funds' ? 'percent' : pick(['percent', 'flat_per_policy']), $cn === 'Mutual Funds' ? 1.0 : 0];
    }
}
foreach ($targetRows as &$t) if ($t[5] === 'percent' && $t[6] == 0) $t[6] = pick([10, 15, 20, 25, 30]); elseif ($t[5] === 'flat_per_policy') $t[6] = pick([500, 750, 1000, 1500]);
unset($t);

// ---------- write everything in one transaction ----------
$db->beginTransaction();
try {
    insert_many($db, 'users', ['id', 'email', 'phone', 'password_hash', 'role', 'full_name', 'created_at'], $users);
    insert_many($db, 'clients', ['id', 'full_name', 'phone', 'email', 'city', 'household_name', 'owner_id', 'created_at'], $clientRows);
    insert_many($db, 'client_policies', ['id', 'client_id', 'policy_number', 'insurer', 'product_type', 'sum_assured', 'premium', 'start_date', 'renewal_date', 'status', 'category_id', 'created_at'], $policyRows);
    insert_many($db, 'leads', ['id', 'full_name', 'phone', 'email', 'city', 'lead_type', 'source', 'owner', 'notes', 'status', 'created_at', 'created_by', 'converted_client_id', 'updated_at', 'assigned_to'], $leadRows);
    insert_many($db, 'opportunities', ['id', 'client_id', 'product_type', 'stage', 'owner_id', 'created_at', 'updated_at'], $oppRows);
    insert_many($db, 'claims', ['id', 'client_id', 'policy_id', 'stage', 'notified_at', 'settled_at', 'notes', 'created_at'], $claimRows);
    insert_many($db, 'communications', ['id', 'client_id', 'channel', 'notes', 'occurred_at', 'logged_by', 'created_at'], $commRows);
    insert_many($db, 'candidates', ['id', 'full_name', 'phone', 'email', 'city', 'occupation', 'track', 'stage', 'source', 'notes', 'created_at'], $candRows);
    insert_many($db, 'tasks', ['id', 'title', 'description', 'assigned_to', 'due_date', 'status', 'linked_client_id', 'linked_candidate_id', 'created_by', 'created_at'], $taskRows);
    insert_many($db, 'calls', ['id', 'lead_name', 'phone', 'source_channel', 'language_detected', 'direction', 'duration_seconds', 'intent_score', 'status', 'notes', 'created_by', 'created_at'], $callRows);
    insert_many($db, 'business_plans', ['id', 'associate_id', 'period_type', 'period_label', 'start_date', 'end_date', 'notes', 'created_by', 'created_at', 'updated_at'], $planRows);
    insert_many($db, 'business_plan_targets', ['id', 'plan_id', 'category_id', 'expected_premium', 'expected_policy_count', 'commission_type', 'commission_value'], $targetRows);
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    fwrite(STDERR, 'FAILED, rolled back: ' . $e->getMessage() . "\n");
    exit(1);
}

$fh = fopen(__DIR__ . '/DEMO_CREDENTIALS.csv', 'w');
fputcsv($fh, ['role', 'name', 'email_login', 'password']);
foreach ($creds as $r) fputcsv($fh, $r);
fclose($fh);

$bySeg = []; foreach ($clients as $c) $bySeg[$c['seg']] = ($bySeg[$c['seg']] ?? 0) + 1;
echo "Seeded: users=" . count($users) . " clients=" . count($clientRows) . " policies=" . count($policyRows) . " leads=" . count($leadRows)
   . " opportunities=" . count($oppRows) . " claims=" . count($claimRows) . " communications=" . count($commRows) . " candidates=" . count($candRows)
   . " tasks=" . count($taskRows) . " calls=" . count($callRows) . " plans=" . count($planRows) . "\n";
echo "Credentials: apps/crm-api/demo/DEMO_CREDENTIALS.csv\n";
