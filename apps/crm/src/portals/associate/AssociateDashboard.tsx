import { useEffect, useState } from "react";
import { Target, TrendingUp, ListChecks, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout } from "../PortalLayout";
import { NotificationStrip } from "../NotificationStrip";
import { PacingBadge } from "../../modules/business-planning/components";
import { planTotals, type BusinessPlan } from "../../modules/business-planning/types";
import { ChartCard, CountUp, DonutChart, FunnelChart, HBars, RadialGauge } from "../../components/charts/charts";
import { C, RAMP, tint } from "../../components/charts/palette";
import { formatINR, formatINRCompact, localDateISO } from "../../lib/format";
import { associateNavItems } from "./nav";

interface LeadRow {
  status: "new" | "contacted" | "qualified" | "converted" | "dropped";
}
interface TaskRow {
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
}

// The API already scopes every one of these lists to the signed-in associate
// (leads.assigned_to, clients.owner_id, tasks.assigned_to), so aggregating
// them here shows only their own numbers.
export function AssociateDashboard() {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    async function load() {
      const [plans, l, t, c] = await Promise.all([
        api.get<BusinessPlan[]>("/business_plans.php").catch((err: unknown) => {
          if (!(err instanceof ApiError)) throw err; // a missing plan is not an error worth surfacing here
          return [] as BusinessPlan[];
        }),
        api.get<LeadRow[]>("/leads.php").catch(() => [] as LeadRow[]),
        api.get<TaskRow[]>("/tasks.php").catch(() => [] as TaskRow[]),
        api.get<{ id: string }[]>("/clients.php").catch(() => [] as { id: string }[]),
      ]);
      const rows = plans ?? [];
      const today = localDateISO(new Date());
      setPlan(rows.find((p) => p.start_date <= today && p.end_date >= today) ?? rows[0] ?? null);
      setLeads(l ?? []);
      setTasks(t ?? []);
      setClientCount((c ?? []).length);
    }
    void load();
  }, []);

  const today = localDateISO(new Date());
  const by = (s: LeadRow["status"]) => leads.filter((l) => l.status === s).length;
  const contacted = by("contacted") + by("qualified") + by("converted");
  const qualified = by("qualified") + by("converted");
  const funnel = [
    { label: "My leads", value: leads.length, color: C.navy },
    { label: "Contacted", value: contacted, color: "color-mix(in srgb, var(--brand-blue) 100%, black 30%)" },
    { label: "Qualified", value: qualified, color: C.blue },
    { label: "Converted", value: by("converted"), color: C.green },
  ];

  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
  const taskSlices = [
    { label: "To do", value: tasks.filter((t) => t.status === "todo").length, color: tint(C.navy, 55) },
    { label: "In progress", value: tasks.filter((t) => t.status === "in_progress").length, color: C.blue },
    { label: "Done", value: tasks.filter((t) => t.status === "done").length, color: C.green },
  ];
  const donePct = tasks.length ? Math.round((taskSlices[2].value / tasks.length) * 100) : 0;

  const totals = plan ? planTotals(plan) : null;
  const planPct = totals && totals.expected > 0 ? Math.round((totals.achieved / totals.expected) * 100) : 0;

  const tiles = [
    { label: "My clients", value: clientCount, Icon: Users, color: C.blue },
    { label: "Open leads", value: leads.filter((l) => l.status !== "converted" && l.status !== "dropped").length, Icon: TrendingUp, color: C.navy },
    { label: "Open tasks", value: openTasks, Icon: ListChecks, color: C.green },
    { label: "Overdue tasks", value: overdue, Icon: ListChecks, color: C.red },
  ];

  return (
    <PortalLayout title="Associate Dashboard" navItems={associateNavItems}>
      <NotificationStrip tasksHref="/associate/tasks" leadsHref="/associate/leads" clientsHref="/associate/clients" />

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="flex items-center justify-between p-4" interactive>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">{t.label}</p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums leading-none text-text">
                <CountUp value={t.value} />
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint(t.color, 12), color: t.color }}>
              <t.Icon className="h-5 w-5" aria-hidden />
            </span>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="My Business Plan"
          subtitle={plan ? plan.period_label : "Target vs achieved premium"}
          href="/associate/business-plan"
          hrefLabel="View details"
        >
          {!plan || !totals ? (
            <EmptyState message="No business plan has been set for you yet." icon={Target} />
          ) : (
            <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
              <div>
                <RadialGauge
                  pct={planPct}
                  label="of target"
                  sub={`${formatINRCompact(totals.achieved)} of ${formatINRCompact(totals.expected)}`}
                  ariaLabel={`Business plan: ${planPct} percent of target achieved`}
                />
                <div className="mt-2 flex justify-center">
                  <PacingBadge plan={plan} />
                </div>
              </div>
              <HBars
                items={plan.targets.map((t, i) => ({
                  label: t.category_name,
                  value: t.expected_premium ? Math.min(100, (t.achieved_premium / t.expected_premium) * 100) : 0,
                  color: RAMP[Math.min(i, RAMP.length - 1)],
                  right: `${t.expected_premium ? Math.round((t.achieved_premium / t.expected_premium) * 100) : 0}%`,
                  sub: `${formatINR(t.achieved_premium)} of ${formatINR(t.expected_premium)}`,
                }))}
                max={100}
              />
            </div>
          )}
        </ChartCard>

        <ChartCard title="My tasks" subtitle={overdue > 0 ? `${overdue} overdue` : "Nothing overdue"} href="/associate/tasks" hrefLabel="Tasks">
          {tasks.length === 0 ? (
            <EmptyState message="No tasks assigned yet." icon={ListChecks} />
          ) : (
            <DonutChart
              slices={taskSlices}
              size={130}
              thickness={5}
              centerValue={`${donePct}%`}
              centerLabel="done"
              layout="stack"
              ariaLabel={`My tasks: ${taskSlices.map((s) => `${s.label} ${s.value}`).join(", ")}`}
            />
          )}
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="My lead funnel" subtitle="Leads assigned to you, by how far they have progressed" href="/associate/leads" hrefLabel="My leads">
          {leads.length === 0 ? (
            <EmptyState message="No leads assigned to you yet." icon={TrendingUp} />
          ) : (
            <div className="mx-auto max-w-2xl">
              <FunnelChart stages={funnel} ariaLabel={`My lead funnel: ${funnel.map((f) => `${f.label} ${f.value}`).join(", ")}`} />
            </div>
          )}
        </ChartCard>
      </div>
    </PortalLayout>
  );
}
