import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarClock, Download, HeartPulse, Info, PhoneCall, Wallet } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { formatDate, formatINR, formatINRCompact } from "../../lib/format";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { DashboardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { ChartCard, CountUp, HBars, LegendDot, RadialGauge, StackedBars, type BarDatum } from "../../components/charts/charts";
import { C, tint } from "../../components/charts/palette";
import { PortalLayout } from "../../portals/PortalLayout";
import { adminNavItems } from "../../portals/admin/nav";
import type { HotspotDim, RetentionStats } from "./types";

const HOTSPOT_TABS: { key: HotspotDim; label: string }[] = [
  { key: "segment", label: "Business line" },
  { key: "product", label: "Product" },
  { key: "insurer", label: "Insurer" },
  { key: "associate", label: "Associate" },
];

const contactText = (d: number | null) => (d === null ? "never contacted" : d === 0 ? "today" : `${d}d ago`);

export function RetentionPage() {
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<HotspotDim>("segment");

  useEffect(() => {
    api
      .get<RetentionStats>("/retention.php")
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load retention data."));
  }, []);

  if (error) {
    return (
      <PortalLayout title="Retention" navItems={adminNavItems}>
        <EmptyState message={`Couldn't load retention data — ${error}`} icon={AlertCircle} />
      </PortalLayout>
    );
  }
  if (!stats) {
    return (
      <PortalLayout title="Retention" navItems={adminNavItems}>
        <DashboardSkeleton />
      </PortalLayout>
    );
  }

  const s = stats.summary;
  const days = stats.rules.engaged_days;

  const pipelineBars: BarDatum[] = stats.pipeline.map((b) => ({
    label: b.label.replace("Due in ", "").replace(" days", "d"),
    parts: [
      { key: "engaged", label: `Contacted in last ${days}d`, value: b.engaged.premium, color: C.blue },
      { key: "not", label: `No contact in ${days}d`, value: b.not_engaged.premium, color: C.red },
    ],
    extra: [`${b.engaged.count + b.not_engaged.count} policies (${b.not_engaged.count} not contacted)`],
    highlight: b.key === "overdue",
  }));

  const cohortBars: BarDatum[] = stats.by_cohort.map((c) => ({
    label: c.year,
    parts: [
      { key: "active", label: "Active", value: c.active, color: C.blue },
      { key: "lapsed", label: "Lapsed", value: c.lapsed, color: C.red },
      { key: "matured", label: "Matured", value: c.matured, color: tint(C.navy, 45) },
    ],
    extra: [c.lapse_pct === null ? "No rate (no active/lapsed)" : `Lapse rate ${c.lapse_pct}% of active + lapsed`],
  }));

  const ageItems = stats.by_age.map((a) => ({
    label: a.label,
    value: a.lapse_pct ?? 0,
    right: a.lapse_pct === null ? "—" : `${a.lapse_pct}%`,
    sub: `${a.lapsed} lapsed of ${a.active + a.lapsed} active + lapsed`,
    color: C.red,
  }));

  const spots = stats.hotspots[tab];
  const spotItems = spots.map((h) => ({
    label: h.label,
    value: h.lapse_pct,
    right: `${h.lapse_pct}%`,
    sub: `${h.lapsed} lapsed of ${h.policies} · ${formatINRCompact(h.lapsed_premium)} premium lost / yr`,
    color: C.red,
  }));

  const tiles = [
    { label: "Premium due in 90 days", value: s.due_90d_premium, sub: `${s.due_90d_count} insurance policies`, Icon: Wallet, color: C.blue },
    { label: "Overdue, not yet renewed", value: s.overdue_premium, sub: `${s.overdue_count} policies past their date`, Icon: CalendarClock, color: C.red },
    { label: "Needs outreach", value: s.at_risk_premium, sub: `${s.at_risk_pct}% of premium due has no contact in ${days}d`, Icon: PhoneCall, color: C.navy },
    { label: "Premium already lost", value: s.lapsed_premium, sub: `${s.lapsed_count} lapsed policies · ${s.lapse_pct ?? 0}% lapse rate`, Icon: HeartPulse, color: C.red },
  ];

  function exportWorklist() {
    downloadCsv(
      "renewals-to-chase.csv",
      ["Client", "Phone", "Product", "Annual premium", "Renewal date", "Days to renewal", "Associate", "Last contact (days ago)"],
      stats!.worklist.map((w) => [w.client_name, w.phone, w.product_type, w.premium, w.renewal_date, w.days_to_renewal, w.associate ?? "Unassigned", w.days_since_contact ?? "never"]),
    );
  }

  return (
    <PortalLayout title="Retention" navItems={adminNavItems}>
      <div className="space-y-6">
        <Card className="flex gap-3 border-l-4 p-4 text-sm text-text-soft" style={{ borderLeftColor: C.blue }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.blue }} aria-hidden />
          <div className="space-y-1">
            <p>
              <strong className="text-text">How to read this.</strong> The system doesn’t record whether a renewal was paid, so “needs outreach” means: an active insurance policy
              that is due or past due and whose client has <em>no logged call, message or email in the last {days} days</em>. Log contacts on the client page and this
              number falls.
            </p>
            <p>
              Lapse dates aren’t recorded either, so the lapse charts show who is <em>lapsed today</em>, grouped by policy age and start year. Mutual Funds are excluded (monthly SIPs
              have no renewal). Groups smaller than {stats.rules.min_sample} policies are left out of the rankings. Premium is annual.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label} className="p-4" interactive>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">{t.label}</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums leading-none text-text">
                    <CountUp value={t.value} format={formatINRCompact} />
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: tint(t.color, 12), color: t.color }}>
                  <t.Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-[11px] text-text-soft">{t.sub}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Renewal pipeline — next 90 days"
            subtitle="Annual premium falling due, split by whether the client has been contacted recently (hover for policy counts)"
            legend={
              <>
                <LegendDot color={C.blue} label={`Contacted in the last ${days} days`} />
                <LegendDot color={C.red} label={`No contact in ${days} days`} />
              </>
            }
          >
            <StackedBars data={pipelineBars} height={290} format={formatINRCompact} integer={false} ariaLabel="Renewal premium due in the next 90 days by time bucket, split by recent client contact" />
          </ChartCard>

          <ChartCard title="Contact coverage" subtitle="Share of premium due (incl. overdue) with recent contact">
            <RadialGauge
              pct={Math.round(100 - s.at_risk_pct)}
              label="covered"
              sub={`${formatINRCompact(s.due_90d_premium - s.at_risk_premium)} of ${formatINRCompact(s.due_90d_premium)}`}
              color={s.at_risk_pct > 50 ? C.red : C.blue}
              ariaLabel={`${Math.round(100 - s.at_risk_pct)} percent of premium due has had contact in the last ${days} days`}
            />
            <p className="mt-5 text-center text-[11px] text-text-soft">Each contact logged on a client page moves this up.</p>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Lapses by start year"
            subtitle="Where each year’s policies stand today (hover for the lapse rate)"
            legend={
              <>
                <LegendDot color={C.blue} label="Active" />
                <LegendDot color={C.red} label="Lapsed" />
                <LegendDot color={tint(C.navy, 45)} label="Matured" />
              </>
            }
          >
            <StackedBars data={cohortBars} height={250} ariaLabel="Policies by start year, split into active, lapsed and matured" />
          </ChartCard>

          <ChartCard title="Lapse rate by policy age" subtitle="Lapsed ÷ (active + lapsed)">
            <HBars items={ageItems} max={Math.max(15, ...ageItems.map((i) => i.value))} />
          </ChartCard>
        </div>

        <ChartCard title="Where lapses concentrate" subtitle={`Highest lapse rates first · groups with fewer than ${stats.rules.min_sample} policies excluded`}>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist">
            {HOTSPOT_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${tab === t.key ? "border-navy bg-navy text-on-navy" : "border-line-strong bg-surface text-text hover:bg-surface-2"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {spotItems.length === 0 ? <EmptyState message="Not enough policies in any group to rank yet." icon={HeartPulse} /> : <HBars items={spotItems} max={Math.max(15, ...spotItems.map((i) => i.value))} />}
        </ChartCard>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text">Call these first</h2>
              <p className="text-xs text-text-soft">Largest premiums due within 30 days (or overdue) with no contact in {days} days</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={exportWorklist} disabled={stats.worklist.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          {stats.worklist.length === 0 ? (
            <EmptyState message="Every policy due soon has had recent contact." icon={PhoneCall} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-soft">
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Policy</th>
                    <th className="px-3 py-2 text-right">Premium / yr</th>
                    <th className="px-3 py-2">Renewal</th>
                    <th className="px-3 py-2">Last contact</th>
                    <th className="px-3 py-2">Associate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.worklist.map((w) => {
                    const overdue = w.days_to_renewal < 0;
                    return (
                      <tr key={w.policy_id} className="border-t border-line">
                        <td className="px-3 py-2">
                          <Link to={`/admin/clients/${w.client_id}`} className="font-medium text-text hover:underline">
                            {w.client_name}
                          </Link>
                          {w.phone && (
                            <a href={`tel:${w.phone}`} className="block text-xs text-text-soft hover:underline">
                              {w.phone}
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-soft">{w.product_type}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums" title={formatINR(w.premium)}>
                          {formatINRCompact(w.premium)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: tint(overdue ? C.red : C.blue, 12), color: overdue ? C.red : C.blue }}>
                            {overdue ? `${-w.days_to_renewal}d overdue` : w.days_to_renewal === 0 ? "today" : `in ${w.days_to_renewal}d`}
                          </span>
                          <span className="ml-2 text-xs text-text-soft">{formatDate(w.renewal_date)}</span>
                        </td>
                        <td className="px-3 py-2 text-text-soft">{contactText(w.days_since_contact)}</td>
                        <td className="px-3 py-2 text-text-soft">{w.associate ?? "Unassigned"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PortalLayout>
  );
}
