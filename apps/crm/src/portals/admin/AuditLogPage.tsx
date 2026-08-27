import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/toast";
import { Card } from "../../components/ui/card";
import { PortalLayout } from "../PortalLayout";
import { formatDate } from "../../lib/format";
import { adminNavItems } from "./nav";

type AuditAction = "insert" | "update" | "delete";

interface AuditRow {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor?: { full_name: string | null } | null;
}

const TABLE_LABEL: Record<string, string> = {
  profiles: "Team Member",
  client_policies: "Policy",
  opportunities: "Pipeline Opportunity",
  claims: "Claim",
};

const ACTION_LABEL: Record<AuditAction, string> = { insert: "Created", update: "Updated", delete: "Deleted" };

// Internal bookkeeping fields that change on nearly every row and add
// noise to a diff without being meaningful to an admin reviewing history.
const IGNORED_FIELDS = new Set(["created_at", "updated_at"]);

function diffFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  keys.forEach((key) => {
    if (IGNORED_FIELDS.has(key)) return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changes.push({ field: key, from: oldData[key], to: newData[key] });
    }
  });
  return changes;
}

function summaryLabel(row: AuditRow): string {
  const data = row.new_data ?? row.old_data;
  if (!data) return row.record_id;
  return (data.full_name as string) ?? (data.title as string) ?? (data.product_type as string) ?? row.record_id;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AuditLogPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_log")
        .select("*, actor:profiles!changed_by(full_name)")
        .order("changed_at", { ascending: false })
        .limit(200);
      if (error) showToast(`Failed to load audit log: ${error.message}`, "error");
      setRows((data as unknown as AuditRow[]) ?? []);
      setLoading(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = tableFilter === "all" ? rows : rows.filter((r) => r.table_name === tableFilter);
  const tables = Array.from(new Set(rows.map((r) => r.table_name)));

  return (
    <PortalLayout title="Audit Log" navItems={adminNavItems}>
      <p className="mb-4 max-w-2xl text-sm text-text-soft">
        Every insert, update, and delete on team member profiles, client policies, pipeline opportunities, and claims —
        logged automatically by a database trigger, not by the app, so it can't be silently skipped.
      </p>

      {tables.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTableFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tableFilter === "all" ? "border-navy bg-navy text-on-navy" : "border-line-strong text-text-soft"
            }`}
          >
            All
          </button>
          {tables.map((t) => (
            <button
              key={t}
              onClick={() => setTableFilter(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                tableFilter === t ? "border-navy bg-navy text-on-navy" : "border-line-strong text-text-soft"
              }`}
            >
              {TABLE_LABEL[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-text-soft">Loading…</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-text-soft">No audit history yet.</p>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => {
            const changes = row.action === "update" ? diffFields(row.old_data, row.new_data) : [];
            return (
              <Card key={row.id} className="p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-text">
                    <span className="font-semibold">{row.actor?.full_name ?? "System"}</span>{" "}
                    {ACTION_LABEL[row.action].toLowerCase()}{" "}
                    <span className="font-medium">{TABLE_LABEL[row.table_name] ?? row.table_name}</span> —{" "}
                    {summaryLabel(row)}
                  </p>
                  <p className="shrink-0 font-mono text-xs text-text-soft">{formatDate(row.changed_at)}</p>
                </div>
                {changes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-text-soft">
                    {changes.map((c) => (
                      <li key={c.field}>
                        <span className="font-mono">{c.field}</span>: {displayValue(c.from)} → {displayValue(c.to)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
