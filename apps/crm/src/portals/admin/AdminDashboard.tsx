import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, UploadCloud, type LucideIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Card } from "../../components/ui/card";
import { PortalLayout } from "../PortalLayout";
import { formatDate, daysUntil } from "../../lib/format";
import { LEAD_PIPELINE, LEAD_STATUS_LABEL, type LeadStatus } from "../../modules/leads/types";
import { INTEGRATIONS } from "./settings/integrations.config";
import { adminNavItems } from "./nav";

// Lead-source display reuses the same icon + brand color already
// established per provider in Settings -> Lead Ingestion Hub, rather than
// a second, inconsistent set of marks. "manual" and "bulk_upload" aren't
// third-party integrations, so they get their own entries here.
const SOURCE_META: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  manual: { label: "Manual Entry", Icon: UserPlus, color: "#8f6f26" },
  bulk_upload: { label: "Bulk CSV Import", Icon: UploadCloud, color: "#5b6272" },
};
INTEGRATIONS.forEach((i) => {
  SOURCE_META[i.id] = { label: i.name, Icon: i.icon, color: i.color };
});

function sourceMeta(source: string) {
  return SOURCE_META[source] ?? { label: source, Icon: UserPlus, color: "#5b6272" };
}

interface RenewalRow {
  id: string;
  product_type: string;
  renewal_date: string;
  clients: { id: string; full_name: string } | null;
}

const TASK_STATUS_LABEL: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [clientCount, setClientCount] = useState(0);
  const [activePolicyCount, setActivePolicyCount] = useState(0);
  const [openClaimCount, setOpenClaimCount] = useState(0);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [leadsBySource, setLeadsBySource] = useState<Record<string, number>>({});
  const [leadsByStatus, setLeadsByStatus] = useState<Record<LeadStatus, number>>({
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    dropped: 0,
  });
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({ todo: 0, in_progress: 0, done: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysOut = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const [clients, activePolicies, openClaims, recentLeads, allLeads, renewalRows, tasks] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("client_policies").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("claims").select("*", { count: "exact", head: true }).neq("stage", "settled"),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabase.from("leads").select("source, status"),
        supabase
          .from("client_policies")
          .select("id, product_type, renewal_date, clients(id, full_name)")
          .eq("status", "active")
          .gte("renewal_date", today)
          .lte("renewal_date", sixtyDaysOut)
          .order("renewal_date", { ascending: true })
          .limit(8),
        supabase.from("tasks").select("status"),
      ]);

      setClientCount(clients.count ?? 0);
      setActivePolicyCount(activePolicies.count ?? 0);
      setOpenClaimCount(openClaims.count ?? 0);
      setNewLeadCount(recentLeads.count ?? 0);

      const bySource: Record<string, number> = {};
      const byStatus: Record<LeadStatus, number> = { new: 0, contacted: 0, qualified: 0, converted: 0, dropped: 0 };
      (allLeads.data ?? []).forEach((l) => {
        bySource[l.source] = (bySource[l.source] ?? 0) + 1;
        byStatus[l.status as LeadStatus] = (byStatus[l.status as LeadStatus] ?? 0) + 1;
      });
      setLeadsBySource(bySource);
      setLeadsByStatus(byStatus);

      setRenewals((renewalRows.data as unknown as RenewalRow[]) ?? []);

      const byTaskStatus: Record<string, number> = { todo: 0, in_progress: 0, done: 0 };
      (tasks.data ?? []).forEach((t) => {
        byTaskStatus[t.status] = (byTaskStatus[t.status] ?? 0) + 1;
      });
      setTaskCounts(byTaskStatus);

      setLoading(false);
    }
    void load();
  }, []);

  const sourceEntries = Object.entries(leadsBySource).sort((a, b) => b[1] - a[1]);
  const maxSourceCount = Math.max(1, ...sourceEntries.map(([, n]) => n));
  const totalLeads = Object.values(leadsByStatus).reduce((a, b) => a + b, 0);

  return (
    <PortalLayout title="Admin Dashboard" navItems={adminNavItems}>
      {loading ? (
        <p className="text-text-soft">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">Total Clients</p>
              <p className="mt-1 font-display text-2xl text-text">{clientCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">Active Policies</p>
              <p className="mt-1 font-display text-2xl text-text">{activePolicyCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">Open Claims</p>
              <p className="mt-1 font-display text-2xl text-text">{openClaimCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">New Leads (30d)</p>
              <p className="mt-1 font-display text-2xl text-text">{newLeadCount}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Leads by Source</h2>
                <Link to="/admin/settings" className="text-xs text-gold-text hover:underline">
                  Manage sources →
                </Link>
              </div>
              {sourceEntries.length === 0 ? (
                <p className="text-sm text-text-soft">No leads captured yet.</p>
              ) : (
                <div className="space-y-3">
                  {sourceEntries.map(([source, count]) => {
                    const meta = sourceMeta(source);
                    const Icon = meta.Icon;
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: meta.color + "1a" }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm text-text">{meta.label}</p>
                            <p className="shrink-0 font-mono text-xs text-text-soft">{count}</p>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${(count / maxSourceCount) * 100}%`, backgroundColor: meta.color }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Leads Pipeline</h2>
                <Link to="/admin/leads" className="text-xs text-gold-text hover:underline">
                  Open Leads Desk →
                </Link>
              </div>
              {totalLeads === 0 ? (
                <p className="text-sm text-text-soft">No leads yet.</p>
              ) : (
                <div className="space-y-3">
                  {LEAD_PIPELINE.map((status) => (
                    <div key={status} className="flex items-center gap-3">
                      <p className="w-24 shrink-0 text-sm text-text-soft">{LEAD_STATUS_LABEL[status]}</p>
                      <div className="h-2 flex-1 rounded-full bg-surface-2">
                        <div
                          className="h-2 rounded-full bg-navy"
                          style={{ width: `${(leadsByStatus[status] / Math.max(1, totalLeads)) * 100}%` }}
                        />
                      </div>
                      <p className="w-6 shrink-0 text-right font-mono text-xs text-text-soft">
                        {leadsByStatus[status]}
                      </p>
                    </div>
                  ))}
                  {leadsByStatus.dropped > 0 && (
                    <p className="pt-1 text-xs text-text-soft">{leadsByStatus.dropped} dropped</p>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Renewals Due (60 days)</h2>
                <Link to="/admin/clients" className="text-xs text-gold-text hover:underline">
                  All clients →
                </Link>
              </div>
              {renewals.length === 0 ? (
                <p className="text-sm text-text-soft">Nothing due in the next 60 days.</p>
              ) : (
                <ul className="space-y-2">
                  {renewals.map((r) => {
                    const days = daysUntil(r.renewal_date) ?? 0;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link
                          to={r.clients ? `/admin/clients/${r.clients.id}` : "#"}
                          className="min-w-0 truncate text-text hover:underline"
                        >
                          {r.clients?.full_name ?? "—"} · {r.product_type}
                        </Link>
                        <span
                          className={`shrink-0 font-mono text-xs ${days <= 14 ? "text-crimson" : "text-text-soft"}`}
                        >
                          {formatDate(r.renewal_date)} ({days}d)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Task Board</h2>
                <Link to="/admin/tasks" className="text-xs text-gold-text hover:underline">
                  Open Tasks →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {Object.keys(TASK_STATUS_LABEL).map((status) => (
                  <div key={status}>
                    <p className="font-display text-2xl text-text">{taskCounts[status] ?? 0}</p>
                    <p className="text-xs text-text-soft">{TASK_STATUS_LABEL[status]}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
