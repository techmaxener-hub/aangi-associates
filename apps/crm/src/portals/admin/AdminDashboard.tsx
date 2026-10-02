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
  Users,
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Wallet,
  PiggyBank,
  Percent,
  ArrowRight,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/useAuth";
import { Card } from "../../components/ui/card";
import { DashboardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import {
  AreaChart,
  ChartCard,
  CountUp,
  DeltaChip,
  DonutChart,
  FunnelChart,
  HBars,
  LegendDot,
  RadialGauge,
  SegmentBar,
  Sparkline,
  StackedBars,
  type BarDatum,
} from "../../components/charts/charts";
import { C, RAMP, segmentColor, tint } from "../../components/charts/palette";
import { PortalLayout } from "../PortalLayout";
import { formatDate, formatINR, formatINRCompact } from "../../lib/format";
import type { ConsolidatedReport } from "../../modules/business-planning/types";
import { INTEGRATIONS } from "./settings/integrations.config";
import type { DashboardStats } from "./dashboardTypes";
import { adminNavItems } from "./nav";

// Lead-source labels/icons reuse the ones from Settings → Lead Ingestion Hub
// (single source of truth); the colours do not — charts stay inside the
// locked brand palette (see components/charts/palette.ts).
const SOURCE_LABEL: Record<string, { label: string; Icon: typeof UserPlus }> = {
  manual: { label: "Manual Entry", Icon: UserPlus },
  bulk_upload: { label: "Bulk CSV Import", Icon: UploadCloud },
};
INTEGRATIONS.forEach((i) => {
  SOURCE_LABEL[i.id] = { label: i.name, Icon: i.icon };
});
const sourceInfo = (s: string) => SOURCE_LABEL[s] ?? { label: s, Icon: UserPlus };

const SEGMENT_ORDER = ["Life Insurance", "Health Insurance", "General Insurance", "Mutual Funds", "Other"];

interface ActionItem {
  id: string;
  kind: "task" | "renewal" | "lead";
  label: string;
  sublabel: string;
  urgency: number; // lower = more urgent
  href: string;
}

// Whole calendar days from `a` to `b` (both YYYY-MM-DD or ISO strings), so an
// item due "today" is exactly 0 regardless of the time of day.
function dayDiff(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

const monthShort = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleString("en-IN", { month: "short" });

function weekLabels(today: string): string[] {
  // 12 weekly buckets ending today; label each by the date its week ends.
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const dt = new Date(y, m - 1, d - (11 - i) * 7);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  });
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [plan, setPlan] = useState<ConsolidatedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // One aggregate request (computed in SQL) instead of downloading every
    // lead/client/policy/task. The business-plan report is separate and
    // optional: if it fails the rest of the dashboard should still render.
    api
      .get<DashboardStats>("/dashboard.php")
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load the dashboard."));
    api
      .get<ConsolidatedReport>("/business_plans.php?consolidated=1")
      .then(setPlan)
      .catch(() => setPlan(null));
  }, []);

  if (error) {
    return (
      <PortalLayout title="Admin Dashboard" navItems={adminNavItems}>
        <EmptyState message={`Couldn't load dashboard data — ${error}`} icon={AlertCircle} />
      </PortalLayout>
    );
  }
  if (!stats) {
    return (
      <PortalLayout title="Admin Dashboard" navItems={adminNavItems}>
        <DashboardSkeleton />
      </PortalLayout>
    );
  }

  const s = stats;
  const today = s.today;
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  // ---- derived chart data -------------------------------------------------
  const leadStatus = s.leads.by_status;
  const reachedContacted = leadStatus.contacted + leadStatus.qualified + leadStatus.converted;
  const reachedQualified = leadStatus.qualified + leadStatus.converted;
  const funnel = [
    { label: "All leads", value: s.leads.total, color: C.navy },
    { label: "Contacted", value: reachedContacted, color: "color-mix(in srgb, var(--brand-blue) 100%, black 30%)" },
    { label: "Qualified", value: reachedQualified, color: C.blue },
    { label: "Converted", value: leadStatus.converted, color: C.green },
  ];

  const segments = [...s.portfolio.segments].sort((a, b) => SEGMENT_ORDER.indexOf(a.name) - SEGMENT_ORDER.indexOf(b.name));
  const segSlices = segments.map((g) => ({
    label: g.name.replace(" Insurance", ""),
    value: g.policies,
    color: segmentColor(g.name),
    sub: g.premium_kind === "monthly_sip" ? `${formatINRCompact(g.premium)} / month SIP` : `${formatINRCompact(g.premium)} / year`,
  }));

  const newBiz: BarDatum[] = s.portfolio.new_business.map((m) => ({
    label: monthShort(m.month),
    parts: SEGMENT_ORDER.filter((n) => m.segments[n]).map((n) => ({ key: n, label: n, value: m.segments[n].count, color: segmentColor(n) })),
    extra: [`Premium: ${formatINRCompact(Object.values(m.segments).reduce((a, v) => a + v.premium, 0))}`],
  }));

  const renewalBars: BarDatum[] = s.renewals.by_month.map((m, i) => ({
    label: monthShort(m.month),
    parts: [{ key: "renewals", label: "Renewals", value: m.count, color: i === 0 ? C.red : C.blue }],
    extra: [`Premium: ${formatINRCompact(m.premium)}`],
  }));

  const sourceEntries = Object.entries(s.leads.by_source);
  const topSources = sourceEntries.slice(0, 7);
  const otherSources = sourceEntries.slice(7).reduce((a, [, n]) => a + n, 0);
  const sourceItems = topSources.map(([src, n], i) => {
    const { label, Icon } = sourceInfo(src);
    return { label, value: n, color: RAMP[Math.min(i, RAMP.length - 1)], icon: <Icon className="h-4 w-4" />, sub: `${Math.round((n / Math.max(1, s.leads.total)) * 100)}% of leads` };
  });
  if (otherSources > 0) sourceItems.push({ label: "Other sources", value: otherSources, color: tint(C.navy, 45), icon: <TrendingUp className="h-4 w-4" />, sub: "" });

  const stage = s.claims.by_stage;
  const claimParts = [
    { label: "Notified", value: stage.notified, color: C.red },
    { label: "Documentation", value: stage.documentation, color: C.navy },
    { label: "Insurer liaison", value: stage.insurer_liaison, color: C.blue },
    { label: "Settled", value: stage.settled, color: C.green },
  ];

  const taskSlices = [
    { label: "To do", value: s.tasks.by_status.todo, color: tint(C.navy, 55) },
    { label: "In progress", value: s.tasks.by_status.in_progress, color: C.blue },
    { label: "Done", value: s.tasks.by_status.done, color: C.green },
  ];
  const taskTotal = taskSlices.reduce((a, t) => a + t.value, 0);
  const taskDonePct = taskTotal ? Math.round((s.tasks.by_status.done / taskTotal) * 100) : 0;

  const planExpected = plan?.associates.reduce((a, r) => a + r.expected_premium, 0) ?? 0;
  const planAchieved = plan?.associates.reduce((a, r) => a + r.achieved_premium, 0) ?? 0;
  const planPct = planExpected ? Math.round((planAchieved / planExpected) * 100) : 0;
  const planRows = (plan?.associates ?? []).slice(0, 5).map((a, i) => ({
    label: a.associate_name,
    value: a.expected_premium ? Math.min(100, (a.achieved_premium / a.expected_premium) * 100) : 0,
    color: RAMP[Math.min(i, RAMP.length - 1)],
    right: `${a.expected_premium ? Math.round((a.achieved_premium / a.expected_premium) * 100) : 0}%`,
    sub: `${formatINR(a.achieved_premium)} of ${formatINR(a.expected_premium)}`,
  }));

  const topAssoc = s.top_associates.map((a, i) => ({
    label: a.name,
    value: a.premium,
    color: RAMP[Math.min(i, RAMP.length - 1)],
    right: formatINRCompact(a.premium),
    sub: `${a.clients} clients · ${a.policies} policies · ${a.converted}/${a.leads} leads converted`,
  }));

  const actions: ActionItem[] = [
    ...s.action_items.tasks.map((t): ActionItem => {
      const d = dayDiff(today, t.due_date);
      return { id: `t-${t.id}`, kind: "task", label: t.title, sublabel: d < 0 ? `Overdue by ${-d}d` : d === 0 ? "Due today" : `Due in ${d}d`, urgency: d, href: "/admin/tasks" };
    }),
    ...s.action_items.renewals.map((r): ActionItem => {
      const d = dayDiff(today, r.renewal_date);
      return { id: `r-${r.id}`, kind: "renewal", label: `${r.client_name} · ${r.product_type} renewal`, sublabel: d === 0 ? "Due today" : `Due in ${d}d`, urgency: d, href: `/admin/clients/${r.client_id}` };
    }),
    ...s.action_items.leads.map((l): ActionItem => {
      const w = Math.max(0, dayDiff(l.created_at, today));
      return { id: `l-${l.id}`, kind: "lead", label: `${l.full_name} — not yet contacted`, sublabel: w === 0 ? "New today" : `Waiting ${w}d`, urgency: -w, href: "/admin/leads" };
    }),
  ]
    .sort((a, b) => a.urgency - b.urgency)
    .slice(0, 7);

  const kpis = [
    { key: "clients", label: "Total clients", Icon: Users, stat: s.kpis.clients, color: C.blue, goodWhen: "up" as const, note: "new in last 30 days" },
    { key: "policies", label: "Active policies", Icon: ShieldCheck, stat: s.kpis.active_policies, color: C.navy, goodWhen: "up" as const, note: "started in last 30 days" },
    { key: "claims", label: "Open claims", Icon: ShieldAlert, stat: s.kpis.open_claims, color: C.red, goodWhen: "down" as const, note: "notified in last 30 days" },
    { key: "leads", label: "New leads (30d)", Icon: TrendingUp, stat: s.kpis.leads_30d, color: C.green, goodWhen: "up" as const, note: "vs previous 30 days" },
  ];

  return (
    <PortalLayout title="Admin Dashboard" navItems={adminNavItems}>
      <div className="space-y-6">
        {/* ---- Hero banner ---------------------------------------------------- */}
        <div
          className="relative overflow-hidden rounded-xl p-6 text-white shadow-raised md:p-8"
          style={{
            background: `radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--brand-blue) 75%, transparent) 0%, transparent 55%), radial-gradient(90% 120% at 0% 100%, color-mix(in srgb, var(--brand-red) 38%, transparent) 0%, transparent 60%), var(--brand-dark-navy)`,
          }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
            <defs>
              <pattern id="dash-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M28 0H0V28" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dash-grid)" />
          </svg>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/70">{formatDate(today)}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">
                {greeting()}
                {firstName ? `, ${firstName}` : ""}.
              </h2>
              <p className="mt-1 max-w-xl text-sm text-white/75">
                {actions.length > 0 ? `${s.tasks.overdue} overdue tasks, ${s.renewals.next_60d_count} renewals in the next 60 days, ${leadStatus.new} leads waiting for a first contact.` : "You're all caught up."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/admin/leads" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-white/90">
                  Leads Desk <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link to="/admin/clients" className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                  Clients
                </Link>
                <Link to="/admin/business-planning" className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                  Business Planning
                </Link>
                <Link to="/admin/analytics" className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                  Pivot Explorer
                </Link>
                <Link to="/admin/retention" className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                  Retention
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
              {[
                { Icon: Wallet, label: "Premium in force", value: s.portfolio.premium_in_force, fmt: formatINRCompact, sub: `${s.portfolio.insurance_policies} insurance policies / yr` },
                { Icon: PiggyBank, label: "Monthly SIP book", value: s.portfolio.sip_monthly, fmt: formatINRCompact, sub: "mutual fund SIPs / month" },
                { Icon: Percent, label: "Lead conversion", value: s.leads.conversion_pct, fmt: (n: number) => `${n.toFixed(1)}%`, sub: `${leadStatus.converted} of ${s.leads.total} leads` },
              ].map((h) => (
                <div key={h.label} className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur-sm sm:block sm:p-4">
                  <h.Icon className="h-5 w-5 shrink-0 text-white/80 sm:mb-1.5 sm:h-4 sm:w-4" aria-hidden />
                  <div className="min-w-0 flex-1 sm:flex-none">
                    <p className="whitespace-nowrap font-mono text-lg font-semibold tabular-nums sm:text-xl">
                      <CountUp value={h.value} format={h.fmt} />
                    </p>
                    <p className="text-[11px] font-semibold text-white/85">{h.label}</p>
                    <p className="text-[10.5px] text-white/60">{h.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- KPI tiles ------------------------------------------------------ */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.key} className="relative overflow-hidden p-4 pb-3" interactive>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">{k.label}</p>
                  <p className="mt-1 font-mono text-3xl font-semibold tabular-nums leading-none text-text">
                    <CountUp value={k.stat.value} />
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: tint(k.color, 12), color: k.color }}>
                  <k.Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <DeltaChip pct={k.stat.change_pct} goodWhen={k.goodWhen} />
                <span className="text-[11px] text-text-soft">
                  {k.stat.last_30d} {k.note}
                </span>
              </div>
              <div className="-mx-4 mt-2">
                <Sparkline values={k.stat.weekly} color={k.color} />
              </div>
            </Card>
          ))}
        </div>

        {/* ---- Lead trend + Today -------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Lead flow — last 12 weeks"
            subtitle="New leads per week, and how many of those have since converted"
            href="/admin/leads"
            hrefLabel="Leads Desk"
            legend={
              <>
                <LegendDot color={C.blue} label="Leads created" />
                <LegendDot color={C.green} label="Now converted" />
              </>
            }
          >
            <AreaChart
              labels={weekLabels(today)}
              series={[
                { name: "Leads created", color: C.blue, values: s.leads.weekly_created },
                { name: "Now converted", color: C.green, values: s.leads.weekly_converted },
              ]}
              height={300}
              ariaLabel="Weekly leads created and converted over the last 12 weeks"
            />
          </ChartCard>

          <ChartCard title="Today" subtitle="Most urgent first" className="lg:col-span-1">
            {actions.length === 0 ? (
              <EmptyState message="Nothing urgent — you're caught up." icon={CheckCircle2} />
            ) : (
              <ul className="-mx-2 divide-y divide-line">
                {actions.map((item) => {
                  const Icon = item.kind === "task" ? AlertCircle : item.kind === "renewal" ? RefreshCw : PhoneCall;
                  const urgent = item.urgency < 0;
                  const bar = item.kind === "task" ? C.red : item.kind === "renewal" ? C.blue : C.navy;
                  return (
                    <li key={item.id}>
                      <Link to={item.href} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-surface-2">
                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: bar }} />
                        <Icon className={`h-4 w-4 shrink-0 ${urgent ? "text-crimson" : "text-text-soft"}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-text">{item.label}</span>
                          <span className={`block font-mono text-[11px] ${urgent ? "text-crimson" : "text-text-soft"}`}>{item.sublabel}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ChartCard>
        </div>

        {/* ---- Portfolio mix + new business ---------------------------------- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Portfolio mix" subtitle="Active policies by business line" href="/admin/clients" hrefLabel="My Clients">
            <DonutChart
              slices={segSlices}
              centerValue={s.portfolio.policy_status.active.toLocaleString("en-IN")}
              centerLabel="active policies"
              layout="stack"
              ariaLabel={`Active policies by business line: ${segSlices.map((x) => `${x.label} ${x.value}`).join(", ")}`}
            />
            <p className="mt-3 text-[11px] text-text-soft">
              {s.portfolio.policy_status.lapsed} lapsed · {s.portfolio.policy_status.matured} matured. Insurance premium is annual; Mutual Fund amounts are monthly SIPs and are never added together.
            </p>
          </ChartCard>

          <ChartCard
            className="lg:col-span-2"
            title="Policies sold — last 6 months"
            subtitle="Count of new policies by month and business line (hover for premium)"
            legend={SEGMENT_ORDER.filter((n) => segments.some((g) => g.name === n)).map((n) => (
              <LegendDot key={n} color={segmentColor(n)} label={n} />
            ))}
          >
            <StackedBars data={newBiz} height={330} ariaLabel="Policies sold per month over the last six months, stacked by business line" />
          </ChartCard>
        </div>

        {/* ---- Pipeline / sources / claims ------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Lead funnel" subtitle="Share of leads that reached each stage or beyond" href="/admin/leads" hrefLabel="Leads Desk">
            <FunnelChart stages={funnel} ariaLabel={`Lead funnel: ${funnel.map((f) => `${f.label} ${f.value}`).join(", ")}`} />
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-text-soft">{leadStatus.new} untouched</span>
              <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: tint(C.red, 12), color: C.red }}>
                {leadStatus.dropped} dropped
              </span>
            </div>
          </ChartCard>

          <ChartCard title="Where leads come from" subtitle="All leads by source" href="/admin/settings" hrefLabel="Manage sources">
            {sourceItems.length === 0 ? <EmptyState message="No leads captured yet." icon={TrendingUp} /> : <HBars items={sourceItems} />}
          </ChartCard>

          <div className="space-y-4">
            <ChartCard title="Claims" subtitle="All claims by stage" href="/admin/claims" hrefLabel="Claim Desk">
              <SegmentBar parts={claimParts} />
            </ChartCard>
            <ChartCard title="Team tasks" subtitle={`${s.tasks.due_today} due today · ${s.tasks.overdue} overdue`} href="/admin/tasks" hrefLabel="Tasks">
              <DonutChart
                slices={taskSlices}
                size={120}
                thickness={5}
                centerValue={`${taskDonePct}%`}
                centerLabel="done"
                ariaLabel={`Tasks: ${taskSlices.map((t) => `${t.label} ${t.value}`).join(", ")}`}
              />
            </ChartCard>
          </div>
        </div>

        {/* ---- Renewals ---------------------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Renewal outlook — next 6 months"
            subtitle="Insurance policies falling due each month (hover for premium at stake)"
            href="/admin/clients"
            hrefLabel="My Clients"
            legend={
              <>
                <LegendDot color={C.red} label="This month (act now)" />
                <LegendDot color={C.blue} label="Upcoming months" />
              </>
            }
          >
            <StackedBars data={renewalBars} height={340} ariaLabel="Insurance renewals due per month for the next six months" />
          </ChartCard>

          <ChartCard title="Renewals due (60 days)" subtitle={`${s.renewals.next_60d_count} policies — next 8 shown`} href="/admin/clients" hrefLabel="All clients">
            {s.renewals.upcoming.length === 0 ? (
              <EmptyState message="Nothing due in the next 60 days." icon={CalendarClock} />
            ) : (
              <ul className="-mx-2 divide-y divide-line">
                {s.renewals.upcoming.map((r) => {
                  const d = dayDiff(today, r.renewal_date);
                  const hot = d <= 14;
                  return (
                    <li key={r.id}>
                      <Link to={`/admin/clients/${r.client_id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2">
                        <span className="min-w-0">
                          <span className="block truncate text-text">{r.client_name}</span>
                          <span className="block truncate text-[11px] text-text-soft">{r.product_type}</span>
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
                          style={{ backgroundColor: tint(hot ? C.red : C.blue, 12), color: hot ? C.red : C.blue }}
                        >
                          {d === 0 ? "today" : `${d}d`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ChartCard>
        </div>

        {/* ---- Business plan + leaderboard ----------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Business plan — this month" subtitle="Achieved premium vs target, all associates" href="/admin/business-planning" hrefLabel="Business Planning">
            {!plan || plan.associates.length === 0 ? (
              <EmptyState message="No business plans set for this month yet." icon={Target} />
            ) : (
              <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
                <RadialGauge
                  pct={planPct}
                  label="of monthly target"
                  sub={`${formatINRCompact(planAchieved)} of ${formatINRCompact(planExpected)}`}
                  ariaLabel={`Business plan achievement: ${planPct} percent of target`}
                />
                <HBars items={planRows} max={100} />
              </div>
            )}
          </ChartCard>

          <ChartCard title="Top associates" subtitle="By annual insurance premium in force from their clients" href="/admin/scorecard" hrefLabel="Scorecards">
            {topAssoc.length === 0 ? <EmptyState message="No associates yet." icon={Trophy} /> : <HBars items={topAssoc} />}
          </ChartCard>
        </div>
      </div>
    </PortalLayout>
  );
}
