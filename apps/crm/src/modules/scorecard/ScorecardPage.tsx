import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Info, Target, Trophy, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { formatDate, formatINR, formatINRCompact } from "../../lib/format";
import { Card } from "../../components/ui/card";
import { DashboardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { ChartCard, CountUp } from "../../components/charts/charts";
import { ForecastChart, RadarChart } from "../../components/charts/RadarForecast";
import { C, tint } from "../../components/charts/palette";
import { PortalLayout } from "../../portals/PortalLayout";
import { adminNavItems } from "../../portals/admin/nav";
import { PACE_LABEL, coachingNotes } from "./coaching";
import type { AssociateCard, PaceStatus, ScorecardStats } from "./types";

type SortKey = "score" | "conversion" | "untouched" | "sold" | "book" | "overdue" | "pace";

const PACE_COLOR: Record<PaceStatus, string> = {
  met: C.green,
  on_pace: C.green,
  slightly_behind: C.blue,
  behind: C.red,
  early: tint(C.navy, 55),
  no_target: tint(C.navy, 55),
};

const SORTERS: Record<SortKey, (a: AssociateCard) => number | null> = {
  score: (a) => a.score,
  conversion: (a) => a.raw.conversion_pct,
  untouched: (a) => a.raw.untouched,
  sold: (a) => a.raw.sold_90d,
  book: (a) => a.raw.premium_in_force,
  overdue: (a) => a.raw.tasks_overdue,
  pace: (a) => a.plan?.pace_ratio ?? null,
};

function PaceChip({ pace }: { pace: PaceStatus }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: PACE_COLOR[pace], backgroundColor: tint(PACE_COLOR[pace], 13) }}>
      {PACE_LABEL[pace]}
    </span>
  );
}

function SortTh({ k, sort, onSort, children, right }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: string; right?: boolean }) {
  return (
    <th className={`px-3 py-2 ${right ? "text-right" : "text-left"}`} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-text">
        {children}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
      </button>
    </th>
  );
}

const MAX_RATIO = 150; // the forecast board's scale: 0–150% of target, with the target marker at 100%

export function ScorecardPage() {
  const [stats, setStats] = useState<ScorecardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });

  useEffect(() => {
    api
      .get<ScorecardStats>("/scorecard.php")
      .then((s) => {
        setStats(s);
        setSelectedId(s.associates[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the scorecards."));
  }, []);

  const rows = useMemo(() => {
    if (!stats) return [];
    const get = SORTERS[sort.key];
    return [...stats.associates].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // missing values always last
      if (y === null) return -1;
      return (x - y) * sort.dir;
    });
  }, [stats, sort]);

  if (error) {
    return (
      <PortalLayout title="Scorecards" navItems={adminNavItems}>
        <EmptyState message={`Couldn't load the scorecards — ${error}`} icon={AlertCircle} />
      </PortalLayout>
    );
  }
  if (!stats) {
    return (
      <PortalLayout title="Scorecards" navItems={adminNavItems}>
        <DashboardSkeleton />
      </PortalLayout>
    );
  }

  const team = stats.team;
  const selected = stats.associates.find((a) => a.id === selectedId) ?? null;
  const planned = stats.associates.filter((a) => a.plan && a.plan.expected > 0).sort((a, b) => (b.plan!.pace_ratio ?? -1) - (a.plan!.pace_ratio ?? -1));
  const notes = selected ? coachingNotes(selected, team) : null;

  const setSortKey = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "untouched" || key === "overdue" ? 1 : -1 }));
  const tiles = [
    { label: "Team target (this period)", value: team.plan.expected, sub: `${team.with_plan} associates with a plan`, Icon: Target, color: C.navy },
    { label: "Achieved so far", value: team.plan.achieved, sub: team.plan.expected ? `${Math.round((team.plan.achieved / team.plan.expected) * 100)}% of target` : "—", Icon: Trophy, color: C.blue },
    { label: "Projected by period end", value: team.plan.projected, sub: `run-rate; ${team.plan.expected ? Math.round((team.plan.projected / team.plan.expected) * 100) : 0}% of target`, Icon: Users, color: team.plan.projected >= team.plan.expected ? C.green : C.red },
  ];

  return (
    <PortalLayout title="Associate Scorecards" navItems={adminNavItems}>
      <div className="space-y-6">
        <Card className="flex gap-3 border-l-4 p-4 text-sm text-text-soft" style={{ borderLeftColor: C.blue }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.blue }} aria-hidden />
          <div className="space-y-1">
            <p>
              <strong className="text-text">How the standing works.</strong> Seven measures (lead conversion, follow-up, sales in 90 days, book size, client contact, task discipline
              and plan pace) are each turned into a <em>percentile</em> against the other associates: 50 is the team median, 100 the best. “Standing” is the average of the measures
              an associate has. Rates need at least {stats.rules.min_sample} leads or tasks, otherwise that measure is left out instead of scoring “1 of 1”.
            </p>
            <p>
              The forecast is a straight <em>run-rate</em>: premium achieved so far ÷ share of the period elapsed, shown once {stats.rules.min_elapsed_pct}% of the period has passed.
              “Achieved” follows Business Planning’s rule exactly. Sales are lumpy, so read it as a pace signal, not a promise.
            </p>
          </div>
        </Card>

        {planned.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {tiles.map((t) => (
                <Card key={t.label} className="flex items-center justify-between p-4" interactive>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">{t.label}</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums leading-none text-text">
                      <CountUp value={t.value} format={formatINRCompact} />
                    </p>
                    <p className="mt-1.5 text-[11px] text-text-soft">{t.sub}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint(t.color, 12), color: t.color }}>
                    <t.Icon className="h-5 w-5" aria-hidden />
                  </span>
                </Card>
              ))}
            </div>

            <ChartCard
              title="Month-end forecast"
              subtitle={`Achieved (bar) and run-rate projection (tick) against target (line) · ${team.plan.behind} behind · ${team.plan.on_pace} on pace or better${team.plan.early ? ` · ${team.plan.early} too early` : ""}`}
            >
              <ul className="space-y-2.5">
                {planned.map((a) => {
                  const p = a.plan!;
                  const achievedPct = Math.min(MAX_RATIO, (p.achieved / p.expected) * 100);
                  const projectedPct = p.projected === null ? null : Math.min(MAX_RATIO, (p.projected / p.expected) * 100);
                  const color = PACE_COLOR[p.pace];
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        aria-pressed={selectedId === a.id}
                        className={`grid w-full grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-2 sm:grid-cols-[9rem_1fr_11rem] ${selectedId === a.id ? "bg-surface-2" : ""}`}
                      >
                        <span className="truncate text-sm text-text">{a.name}</span>
                        <span className="relative block h-5" aria-hidden>
                          <span className="absolute inset-y-1.5 left-0 right-0 rounded-full bg-surface-2" />
                          <span className="absolute inset-y-1.5 left-0 rounded-full" style={{ width: `${(achievedPct / MAX_RATIO) * 100}%`, background: `linear-gradient(90deg, ${tint(color, 55)}, ${color})` }} />
                          {projectedPct !== null && <span className="absolute inset-y-0.5 w-1 rounded-sm" style={{ left: `calc(${(projectedPct / MAX_RATIO) * 100}% - 2px)`, backgroundColor: color, opacity: 0.55 }} />}
                          <span className="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${(100 / MAX_RATIO) * 100}%` }} />
                        </span>
                        <span className="col-span-2 flex items-center justify-between gap-2 text-[11px] text-text-soft sm:col-span-1 sm:justify-end">
                          <span className="font-mono tabular-nums" title={`${formatINR(p.achieved)} of ${formatINR(p.expected)}`}>
                            {formatINRCompact(p.achieved)} / {formatINRCompact(p.expected)}
                          </span>
                          <PaceChip pace={p.pace} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-text-soft">Scale runs from 0 to 150% of each target; the black line is 100%.</p>
            </ChartCard>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="overflow-hidden p-0 lg:col-span-3">
            <div className="border-b border-line p-4">
              <h2 className="font-display text-lg font-semibold text-text">Leaderboard</h2>
              <p className="text-xs text-text-soft">{stats.associates.length} associates · click a column to sort, a row to open the scorecard</p>
            </div>
            <div className="max-h-[38rem] overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2 text-xs text-text-soft">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <SortTh k="score" sort={sort} onSort={setSortKey}>Standing</SortTh>
                    <SortTh k="conversion" sort={sort} onSort={setSortKey} right>
                      Conv.
                    </SortTh>
                    <SortTh k="untouched" sort={sort} onSort={setSortKey} right>
                      Untouched
                    </SortTh>
                    <SortTh k="sold" sort={sort} onSort={setSortKey} right>
                      Sold 90d
                    </SortTh>
                    <SortTh k="book" sort={sort} onSort={setSortKey} right>
                      Book
                    </SortTh>
                    <SortTh k="overdue" sort={sort} onSort={setSortKey} right>
                      Overdue
                    </SortTh>
                    <SortTh k="pace" sort={sort} onSort={setSortKey}>Plan pace</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`cursor-pointer border-t border-line hover:bg-surface-2 ${selectedId === a.id ? "bg-surface-2" : ""}`}
                      aria-selected={selectedId === a.id}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-text-soft">{i + 1}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setSelectedId(a.id)} className="block w-full text-left">
                          <span className="block truncate font-medium text-text">{a.name}</span>
                          <span className="mt-1 flex items-center gap-2">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                              <span className="block h-full rounded-full" style={{ width: `${a.score ?? 0}%`, backgroundColor: (a.score ?? 0) >= 66 ? C.green : (a.score ?? 0) >= 40 ? C.blue : C.red }} />
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-text-soft">{a.score === null ? "n/a" : Math.round(a.score)}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{a.raw.conversion_pct === null ? "—" : `${a.raw.conversion_pct}%`}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums" style={a.raw.untouched > 0 && a.raw.oldest_untouched_days >= 30 ? { color: C.red } : undefined}>
                        {a.raw.untouched}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{a.raw.sold_90d}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatINRCompact(a.raw.premium_in_force)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums" style={a.raw.tasks_overdue > 0 ? { color: C.red } : undefined}>
                        {a.raw.tasks_overdue}
                      </td>
                      <td className="px-3 py-2">{a.plan ? <PaceChip pace={a.plan.pace} /> : <span className="text-xs text-text-soft">no plan</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="lg:col-span-2">
            {selected && notes ? (
              <Card className="space-y-5 p-5 lg:sticky lg:top-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-text">{selected.name}</h2>
                    <p className="text-xs text-text-soft">
                      {selected.raw.clients} clients · {selected.raw.active_policies} active policies · {selected.raw.leads} leads assigned
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-3xl font-semibold tabular-nums leading-none" style={{ color: (selected.score ?? 0) >= 66 ? C.green : (selected.score ?? 0) >= 40 ? C.blue : C.red }}>
                      {selected.score === null ? "n/a" : Math.round(selected.score)}
                    </p>
                    <p className="text-[11px] text-text-soft">standing / 100</p>
                  </div>
                </div>

                <RadarChart
                  axes={stats.axes.map((x) => x.label)}
                  series={[{ name: selected.name, color: C.blue, values: stats.axes.map((x) => selected.pct[x.key]) }]}
                  ariaLabel={`${selected.name}: percentile against the team on ${stats.axes.map((x) => x.label).join(", ")}`}
                />
                {stats.axes.some((x) => selected.pct[x.key] === null) && (
                  <p className="-mt-3 text-center text-[11px] text-text-soft">Hollow dots: not enough data for that measure yet, so it is drawn at the median and left out of the standing.</p>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {[
                    ["Lead conversion", selected.raw.conversion_pct === null ? "—" : `${selected.raw.conversion_pct}%`, `${selected.raw.converted} of ${selected.raw.leads}`],
                    ["Untouched leads", String(selected.raw.untouched), selected.raw.untouched ? `oldest ${selected.raw.oldest_untouched_days}d` : "none waiting"],
                    ["Sold, last 90 days", String(selected.raw.sold_90d), `${selected.raw.sold_30d} in last 30`],
                    ["Premium in force", formatINRCompact(selected.raw.premium_in_force), "annual, insurance"],
                    ["Contacts logged (30d)", String(selected.raw.comms_30d), "calls, messages, emails"],
                    ["Tasks", selected.raw.tasks_done_pct === null ? `${selected.raw.tasks} total` : `${selected.raw.tasks_done_pct}% done`, selected.raw.tasks_overdue ? `${selected.raw.tasks_overdue} overdue` : "none overdue"],
                  ].map(([label, value, sub]) => (
                    <div key={label}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft">{label}</p>
                      <p className="font-mono text-lg font-semibold tabular-nums text-text">{value}</p>
                      <p className="text-[11px] text-text-soft">{sub}</p>
                    </div>
                  ))}
                </div>

                {selected.plan && selected.plan.expected > 0 && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-base font-semibold text-text">{selected.plan.label} — plan pace</h3>
                      <PaceChip pace={selected.plan.pace} />
                    </div>
                    <ForecastChart
                      totalDays={selected.plan.total_days}
                      daily={selected.plan.daily}
                      expected={selected.plan.expected}
                      projected={selected.plan.projected}
                      format={formatINRCompact}
                      startLabel={formatDate(selected.plan.start)}
                      endLabel={formatDate(selected.plan.end)}
                      ariaLabel={`${selected.name}: cumulative premium against target for ${selected.plan.label}`}
                    />
                    {selected.plan.pace === "early" && <p className="mt-2 text-[11px] text-text-soft">Too early in the period for a projection ({selected.plan.elapsed_days} of {selected.plan.total_days} days).</p>}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-soft">Strengths</h3>
                    {notes.strengths.length ? (
                      <ul className="space-y-1.5 text-sm">
                        {notes.strengths.map((s) => (
                          <li key={s} className="flex gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: C.green }} />
                            <span className="text-text">{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-text-soft">No measure in the team’s top quarter yet.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-soft">Focus areas</h3>
                    {notes.focus.length ? (
                      <ul className="space-y-1.5 text-sm">
                        {notes.focus.map((s) => (
                          <li key={s} className="flex gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: C.red }} />
                            <span className="text-text">{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-text-soft">Nothing in the team’s bottom third.</p>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <EmptyState message="Select an associate to see their scorecard." icon={Users} />
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
