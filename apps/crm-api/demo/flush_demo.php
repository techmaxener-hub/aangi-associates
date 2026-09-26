<?php
declare(strict_types=1);
require __DIR__ . '/_common.php';

// Removes ONLY rows created by seed_demo.php (ids starting with DEMO_PREFIX,
// plus portal users/OTP rows that were auto-created for demo client phones).
// Dry run by default; pass --yes to actually delete.
//   php apps/crm-api/demo/flush_demo.php          (counts only)
//   php apps/crm-api/demo/flush_demo.php --yes    (delete)

$go = in_array('--yes', $argv, true);
$db = demo_db();
$p = DEMO_PREFIX . '%';

$count = function (string $sql, array $args = []) use ($db): int {
    $s = $db->prepare($sql); $s->execute($args); return (int) $s->fetchColumn();
};

$tables = ['users', 'clients', 'leads', 'client_policies', 'opportunities', 'claims', 'communications',
           'candidates', 'tasks', 'calls', 'business_plans'];
echo $go ? "FLUSHING demo data\n" : "DRY RUN (add --yes to delete)\n";
foreach ($tables as $t) echo str_pad($t, 18), $count("SELECT COUNT(*) FROM $t WHERE id LIKE ?", [$p]), "\n";

// Portal users auto-created by OTP login for demo clients' phones (non-demo ids).
$portalUsers = $db->prepare("SELECT DISTINCT portal_user_id FROM clients WHERE id LIKE ? AND portal_user_id IS NOT NULL AND portal_user_id NOT LIKE ?");
$portalUsers->execute([$p, $p]);
$portalUserIds = array_column($portalUsers->fetchAll(), 'portal_user_id');
$demoPhones = array_column($db->query("SELECT phone FROM clients WHERE id LIKE '" . DEMO_PREFIX . "%'")->fetchAll(), 'phone');
echo "portal users to remove: ", count($portalUserIds), "\n";
if (!$go) exit(0);

$db->beginTransaction();
try {
    $db->exec('SET FOREIGN_KEY_CHECKS = 0'); // order-independent; integrity restored by explicit deletes + NULLing below
    $exec = fn (string $sql, array $a = []) => $db->prepare($sql)->execute($a);

    // Real (non-demo) rows that reference demo users: detach, don't delete.
    $userRefs = ['leads' => ['assigned_to', 'created_by'], 'clients' => ['owner_id'], 'tasks' => ['assigned_to', 'created_by'],
                 'opportunities' => ['owner_id'], 'communications' => ['logged_by'], 'documents' => ['uploaded_by'],
                 'calls' => ['created_by'], 'audit_log' => ['changed_by'], 'app_errors' => ['user_id'],
                 'integration_settings' => ['updated_by'], 'business_plan_sends' => ['sent_by'], 'business_plans' => ['created_by']];
    foreach ($userRefs as $t => $cols) foreach ($cols as $c) {
        $exec("UPDATE $t SET $c = NULL WHERE $c LIKE ? AND id NOT LIKE ?", [$p, $p]);
    }
    // Real rows that point at demo clients can't survive them; detach the nullable links.
    $exec("UPDATE leads SET converted_client_id = NULL WHERE converted_client_id LIKE ? AND id NOT LIKE ?", [$p, $p]);
    $exec("UPDATE tasks SET linked_client_id = NULL WHERE linked_client_id LIKE ? AND id NOT LIKE ?", [$p, $p]);

    // Children of demo clients (cascade would handle most; explicit for clarity + non-cascading FKs).
    foreach (['renewal_reminders' => 'client_id', 'documents' => 'client_id', 'communications' => 'client_id',
              'claims' => 'client_id', 'opportunities' => 'client_id', 'client_policies' => 'client_id'] as $t => $c) {
        $exec("DELETE FROM $t WHERE $c LIKE ? OR id LIKE ?", [$p, $p]);
    }
    $exec("DELETE FROM business_plans WHERE id LIKE ? OR associate_id LIKE ?", [$p, $p]); // targets/sends cascade
    $exec("DELETE FROM tasks WHERE id LIKE ?", [$p]);
    $exec("DELETE FROM leads WHERE id LIKE ?", [$p]);
    $exec("DELETE FROM candidates WHERE id LIKE ?", [$p]);
    $exec("DELETE FROM calls WHERE id LIKE ?", [$p]);
    $exec("DELETE FROM audit_log WHERE record_id LIKE ? OR changed_by LIKE ?", [$p, $p]);
    $exec("DELETE FROM clients WHERE id LIKE ?", [$p]);
    foreach ($demoPhones as $ph) $exec("DELETE FROM otp_codes WHERE phone = ?", [$ph]);
    foreach ($portalUserIds as $uid) $exec("DELETE FROM users WHERE id = ?", [$uid]);
    $exec("DELETE FROM users WHERE id LIKE ?", [$p]);

    $db->exec('SET FOREIGN_KEY_CHECKS = 1');
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    $db->exec('SET FOREIGN_KEY_CHECKS = 1');
    fwrite(STDERR, "FAILED, rolled back: " . $e->getMessage() . "\n");
    exit(1);
}
echo "Done. Remaining demo rows:\n";
foreach ($tables as $t) echo str_pad($t, 18), $count("SELECT COUNT(*) FROM $t WHERE id LIKE ?", [$p]), "\n";
@unlink(__DIR__ . '/DEMO_CREDENTIALS.csv');
