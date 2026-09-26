import { Badge } from "../../components/ui/badge";
import { formatINR } from "../../lib/format";
import {
  planTotals,
  pacingStatus,
  PACING_LABEL,
  PACING_BADGE_VARIANT,
  type BusinessPlan,
  type PlanTarget,
} from "./types";

// One bar treatment for every "target vs achieved" display in this module
// (plan cards, the detail breakdown, dashboard widgets) — width capped at
// 100% visually even when achievement overshoots the target, with the
// overshoot still visible in the numbers beside it.
export function ProgressBar({ pct, color = "var(--navy)" }: { pct: number; color?: string }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 flex-1 rounded-full bg-surface-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
}

export function PacingBadge({ plan }: { plan: BusinessPlan }) {
  const status = pacingStatus(plan);
  return <Badge variant={PACING_BADGE_VARIANT[status]}>{PACING_LABEL[status]}</Badge>;
}

// Compact overall-progress line — used on plan-list cards and dashboard
// widgets where the per-category breakdown would be too much detail.
export function PlanOverallProgress({ plan }: { plan: BusinessPlan }) {
  const { expected, achieved } = planTotals(plan);
  const pct = expected > 0 ? Math.round((achieved / expected) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-text-soft">
          {formatINR(achieved)} of {formatINR(expected)}
        </span>
        <span className="font-mono font-semibold text-text">{pct}%</span>
      </div>
      <ProgressBar pct={pct} color={pct >= 100 ? "var(--gold)" : "var(--navy)"} />
    </div>
  );
}

// The full per-category breakdown table — reused as-is by the admin plan
// detail drawer and the associate's read-only view, so the two can never
// show different numbers for the same plan.
export function PlanTargetsBreakdown({ targets }: { targets: PlanTarget[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
          <tr>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Progress</th>
            <th className="px-4 py-2.5 text-right">Target</th>
            <th className="px-4 py-2.5 text-right">Achieved</th>
            <th className="px-4 py-2.5 text-right">Commission</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => {
            const pct = t.expected_premium ? Math.round((t.achieved_premium / t.expected_premium) * 100) : 0;
            return (
              <tr key={t.id} className="border-t border-line odd:bg-surface-2/40">
                <td className="px-4 py-2.5 font-medium text-text">{t.category_name}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={pct} color={pct >= 100 ? "var(--gold)" : "var(--navy)"} />
                    <span className="w-10 shrink-0 text-right font-mono text-xs text-text-soft">{pct}%</span>
                  </div>
                  {t.expected_policy_count !== null && (
                    <p className="mt-1 text-xs text-text-soft">
                      {t.achieved_count} / {t.expected_policy_count} policies
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-soft">
                  {formatINR(t.expected_premium)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text">
                  {formatINR(t.achieved_premium)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gold-text">
                  {formatINR(t.commission_earned)}
                  {t.commission_expected > 0 && (
                    <span className="text-text-soft"> / {formatINR(t.commission_expected)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Hand-rolled horizontal bar chart (no charting library — see the approved
// plan doc) for the Consolidated tab: target vs achieved per row, sharing
// one scale across all rows so relative size reads correctly at a glance.
export function ComparisonBarChart({ rows }: { rows: { label: string; expected: number; achieved: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.expected, r.achieved)));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="truncate text-text">{r.label}</span>
            <span className="shrink-0 font-mono text-text-soft">
              {formatINR(r.achieved)} / {formatINR(r.expected)}
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-surface-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-line-strong"
              style={{ width: `${(r.expected / max) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${(r.achieved / max) * 100}%`, backgroundColor: "var(--navy)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
