import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus,
  UploadCloud,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  TrendingUp,
  CalendarClock,
  Target,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { DashboardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout } from "../PortalLayout";
import { formatDate, formatINR, daysUntil, localDateISO } from "../../lib/format";
import { LEAD_PIPELINE, LEAD_STATUS_LABEL, type LeadStatus } from "../../modules/leads/types";
import type { ConsolidatedReport } from "../../modules/business-planning/types";
import { INTEGRATIONS } from "./settings/integrations.config";
import { adminNavItems } from "./nav";

// A single merged, urgency-sorted list beats three separate panels the
// admin has to scan independently — this is the "Today" widget: overdue
// tasks, renewals due this week, and leads not yet contacted, ranked by
// how urgent each actually is (not by which table it came from).
interface TodayItem {
  id: string;
  kind: "task" | "renewal" | "lead";
  label: string;
  sublabel: string;
  urgencyDays: number; // negative = overdue/waiting; lower = more urgent
  href: string;
}

// Lead-source display reuses the same icon + brand color already
// established per provider in Settings -> Lead Ingestion Hub, rather than
// a second, inconsistent set of marks. "manual" and "bulk_upload" aren't
// third-party integrations, so they get their own entries here.
const SOURCE_META: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  manual: { label: "Manual Entry", Icon: UserPlus, color: "var(--gold)" },
  bulk_upload: { label: "Bulk CSV Import", Icon: UploadCloud, color: "var(--text-soft)" },
};
INTEGRATIONS.forEach((i) => {
  SOURCE_META[i.id] = { label: i.name, Icon: i.icon, color: i.color };
});

function sourceMeta(source: string) {
  return SOURCE_META[source] ?? { label: source, Icon: UserPlus, color: "var(--text-soft)" };
}

interface RenewalRow {
  id: string;
  product_type: string;
  renewal_date: string;
  status: string;
  client: { id: string; full_name: string } | null;
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
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);
  const [businessPlan, setBusinessPlan] = useState<ConsolidatedReport | null>(null);

  useEffect(() => {
    // No RLS anymore to do this scoping server-side per-query, and these
    // endpoints return plain lists rather than Supabase's count:"exact"
    // head requests — this is an admin-only dashboard over a small
    // business's data, so fetching full lists and aggregating client-side
    // is the simpler, equally-correct trade here rather than adding a
    // dozen narrow count/filter query params to the PHP endpoints.
    async function load() {
      setLoading(true);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
      const now = new Date();
      const today = localDateISO(now);
      const sixtyDaysOut = localDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60));

      const [clients, allPolicies, allClaims, allLeads, allTasks, plan] = await Promise.all([
        api.get<{ id: string }[]>("/clients.php"),
        api.get<RenewalRow[]>("/client_policies.php"),
        api.get<{ stage: string }[]>("/claims.php"),
        api.get<
          {
            id: string;
            full_name: string;
            source: string;
            status: LeadStatus;
            created_at: string;
            assigned_to: string | null;
          }[]
        >("/leads.php"),
        api.get<{ id: string; title: string; status: string; due_date: string | null }[]>("/tasks.php"),
        api.get<ConsolidatedReport>("/business_plans.php?consolidated=1"),
      ]);
      setBusinessPlan(plan);

      setClientCount(clients?.length ?? 0);
      setActivePolicyCount((allPolicies ?? []).filter((p) => p.status === "active").length);
      setOpenClaimCount((allClaims ?? []).filter((c) => c.stage !== "settled").length);
      setNewLeadCount((allLeads ?? []).filter((l) => new Date(l.created_at).getTime() >= thirtyDaysAgo).length);

      const bySource: Record<string, number> = {};
      const byStatus: Record<LeadStatus, number> = { new: 0, contacted: 0, qualified: 0, converted: 0, dropped: 0 };
      (allLeads ?? []).forEach((l) => {
        bySource[l.source] = (bySource[l.source] ?? 0) + 1;
        byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      });
      setLeadsBySource(bySource);
      setLeadsByStatus(byStatus);

      setRenewals(
        (allPolicies ?? [])
          .filter((p) => p.status === "active" && p.renewal_date >= today && p.renewal_date <= sixtyDaysOut)
          .sort((a, b) => (a.renewal_date < b.renewal_date ? -1 : 1))
          .slice(0, 8),
      );

      const byTaskStatus: Record<string, number> = { todo: 0, in_progress: 0, done: 0 };
      (allTasks ?? []).forEach((t) => {
        byTaskStatus[t.status] = (byTaskStatus[t.status] ?? 0) + 1;
      });
      setTaskCounts(byTaskStatus);

      // "Today": overdue/due-soon tasks, renewals due within a week, and
      // leads still untouched — merged into one urgency-ranked list rather
      // than three panels the admin has to check separately.
      const items: TodayItem[] = [];
      (allTasks ?? [])
        .filter((t) => t.status !== "done" && t.due_date)
        .forEach((t) => {
          const days = daysUntil(t.due_date as string) ?? 0;
          items.push({
            id: `task-${t.id}`,
            kind: "task",
            label: t.title,
            sublabel: days < 0 ? `Overdue by ${Math.abs(days)}d` : days === 0 ? "Due today" : `Due in ${days}d`,
            urgencyDays: days,
            href: "/admin/tasks",
          });
        });
      (allPolicies ?? [])
        .filter((p) => p.status === "active" && p.renewal_date >= today)
        .forEach((p) => {
          const days = daysUntil(p.renewal_date) ?? 0;
          if (days > 7) return;
          items.push({
            id: `renewal-${p.id}`,
            kind: "renewal",
            label: `${p.client?.full_name ?? "Client"} · ${p.product_type} renewal`,
            sublabel: days === 0 ? "Due today" : `Due in ${days}d`,
            urgencyDays: days,
            href: p.client ? `/admin/clients/${p.client.id}` : "/admin/clients",
          });
        });
      (allLeads ?? [])
        .filter((l) => l.status === "new")
        .forEach((l) => {
          const waitingDays = Math.floor((Date.now() - new Date(l.created_at).getTime()) / (24 * 60 * 60 * 1000));
          items.push({
            id: `lead-${l.id}`,
            kind: "lead",
            label: `${l.full_name} — not yet contacted`,
            sublabel: waitingDays <= 0 ? "New today" : `Waiting ${waitingDays}d`,
            urgencyDays: -waitingDays,
            href: "/admin/leads",
          });
        });
      items.sort((a, b) => a.urgencyDays - b.urgencyDays);
      setTodayItems(items.slice(0, 8));

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
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <Card className="p-5" interactive>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg text-text">Today</h2>
              <p className="text-xs text-text-soft">Overdue tasks, renewals due this week, and uncontacted leads</p>
            </div>
            {todayItems.length === 0 ? (
              <EmptyState message="Nothing urgent — you're caught up." icon={CheckCircle2} />
            ) : (
              <ul className="divide-y divide-line">
                {todayItems.map((item) => {
                  const Icon = item.kind === "task" ? AlertCircle : item.kind === "renewal" ? RefreshCw : PhoneCall;
                  const urgent = item.urgencyDays < 0;
                  // A color per kind (not just per urgency) so the list is
                  // scannable at a glance before reading any text — tasks,
                  // renewals, and leads each get their own consistent hue.
                  const kindBorder =
                    item.kind === "task"
                      ? "border-l-crimson"
                      : item.kind === "renewal"
                        ? "border-l-gold"
                        : "border-l-navy";
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.href}
                        className={`flex items-center gap-3 border-l-4 py-2.5 pl-3 pr-2 text-sm hover:bg-surface-2 -mx-2 rounded-md ${kindBorder}`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${urgent ? "text-crimson" : "text-gold-text"}`} />
                        <span className="min-w-0 flex-1 truncate text-text">{item.label}</span>
                        <span className={`shrink-0 font-mono text-xs ${urgent ? "text-crimson" : "text-text-soft"}`}>
                          {item.sublabel}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-4" interactive>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">Total Clients</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text">{clientCount}</p>
            </Card>
            <Card className="p-4" interactive>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">Active Policies</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text">{activePolicyCount}</p>
            </Card>
            <Card className="p-4" interactive>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">Open Claims</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text">{openClaimCount}</p>
            </Card>
            <Card className="p-4" interactive>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">New Leads (30d)</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text">{newLeadCount}</p>
            </Card>
          </div>

          <Card className="p-5" interactive>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg text-text">Business Plan — This Month</h2>
              <Link to="/admin/business-planning" className="text-xs text-gold-text hover:underline">
                Open Business Planning →
              </Link>
            </div>
            {!businessPlan || businessPlan.associates.length === 0 ? (
              <EmptyState message="No business plans set for this month yet." icon={Target} />
            ) : (
              <div className="space-y-3">
                {businessPlan.associates.map((a) => {
                  const pct = a.expected_premium ? Math.round((a.achieved_premium / a.expected_premium) * 100) : 0;
                  return (
                    <div key={a.associate_id} className="flex items-center gap-3">
                      <p className="w-32 shrink-0 truncate text-sm text-text">{a.associate_name}</p>
                      <div className="h-2 flex-1 rounded-full bg-surface-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: pct >= 100 ? "var(--gold)" : "var(--navy)",
                          }}
                        />
                      </div>
                      <p className="w-36 shrink-0 text-right font-mono text-xs text-text-soft">
                        {formatINR(a.achieved_premium)} / {formatINR(a.expected_premium)} ({pct}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5" interactive>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Leads by Source</h2>
                <Link to="/admin/settings" className="text-xs text-gold-text hover:underline">
                  Manage sources →
                </Link>
              </div>
              {sourceEntries.length === 0 ? (
                <EmptyState message="No leads captured yet." icon={TrendingUp} />
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

            <Card className="p-5" interactive>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Leads Pipeline</h2>
                <Link to="/admin/leads" className="text-xs text-gold-text hover:underline">
                  Open Leads Desk →
                </Link>
              </div>
              {totalLeads === 0 ? (
                <EmptyState message="No leads yet." icon={TrendingUp} />
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
            <Card className="p-5" interactive>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Renewals Due (60 days)</h2>
                <Link to="/admin/clients" className="text-xs text-gold-text hover:underline">
                  All clients →
                </Link>
              </div>
              {renewals.length === 0 ? (
                <EmptyState message="Nothing due in the next 60 days." icon={CalendarClock} />
              ) : (
                <ul className="space-y-2">
                  {renewals.map((r) => {
                    const days = daysUntil(r.renewal_date) ?? 0;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link
                          to={r.client ? `/admin/clients/${r.client.id}` : "#"}
                          className="min-w-0 truncate text-text hover:underline"
                        >
                          {r.client?.full_name ?? "—"} · {r.product_type}
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

            <Card className="p-5" interactive>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-text">Task Board</h2>
                <Link to="/admin/tasks" className="text-xs text-gold-text hover:underline">
                  Open Tasks →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {Object.keys(TASK_STATUS_LABEL).map((status) => (
                  <div key={status}>
                    <p className="font-mono text-2xl font-semibold tabular-nums text-text">{taskCounts[status] ?? 0}</p>
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
