<?php
declare(strict_types=1);

// Replaces the Postgres `log_audit()` trigger (0011_audit_log.sql), which
// generically snapshotted any row via to_jsonb(OLD/NEW) + TG_TABLE_NAME/
// TG_OP. MySQL has no whole-row-to-JSON trigger equivalent, so this is
// called explicitly, once per mutation, from the same 4 endpoints that
// were triggered before: users (was profiles), client_policies,
// opportunities, claims. $old/$new are associative arrays or null.
function log_audit(string $table, string $recordId, string $action, ?array $old, ?array $new): void
{
    $stmt = db()->prepare(
        'INSERT INTO audit_log (id, table_name, record_id, action, changed_by, changed_at, old_data, new_data)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)'
    );
    $stmt->execute([
        uuid4(),
        $table,
        $recordId,
        $action,
        $_SESSION['user_id'] ?? null,
        $old !== null ? json_encode($old) : null,
        $new !== null ? json_encode($new) : null,
    ]);
}
