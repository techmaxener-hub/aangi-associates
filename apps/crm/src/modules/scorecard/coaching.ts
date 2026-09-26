import { formatINRCompact } from "../../lib/format";
import type { AssociateCard, AxisKey, PaceStatus, ScorecardStats } from "./types";

// Rule-based, deliberately transparent coaching notes: a strength is a measure in
// the top quarter of the team, a focus area is one in the bottom third, and every
// note quotes the actual number and the team median so the admin can judge it.

const STRONG = 75;
const WEAK = 33;

const median = (v: number | null | undefined, suffix = "") => (v === null || v === undefined ? "" : ` (team median ${suffix === "₹" ? formatINRCompact(v) : Math.round(v * 10) / 10}${suffix === "%" ? "%" : ""})`);

export const PACE_LABEL: Record<PaceStatus, string> = {
  met: "Target met",
  on_pace: "On pace",
  slightly_behind: "Slightly behind",
  behind: "Behind",
  early: "Too early to call",
  no_target: "No target",
};

function strength(axis: AxisKey, a: AssociateCard, team: ScorecardStats["team"]): string | null {
  const r = a.raw;
  switch (axis) {
    case "conversion":
      return r.conversion_pct === null ? null : `Converts ${r.conversion_pct}% of assigned leads${median(team.median.conversion_pct, "%")}`;
    case "followup":
      return r.contacted_pct === null ? null : `Has contacted ${r.contacted_pct}% of assigned leads`;
    case "sales":
      return `${r.sold_90d} policies started in the last 90 days${median(team.median.sold_90d)}`;
    case "book":
      return `${formatINRCompact(r.premium_in_force)} annual premium in force${median(team.median.premium_in_force, "₹")}`;
    case "activity":
      return `${r.comms_30d} client contacts logged in 30 days${median(team.median.comms_30d)}`;
    case "tasks":
      return r.tasks_done_pct === null ? null : `${r.tasks_done_pct}% of their tasks are done`;
    case "pace":
      return a.plan?.pace_ratio == null ? null : `Projected at ${Math.round(a.plan.pace_ratio)}% of this period’s target`;
  }
}

function focus(axis: AxisKey, a: AssociateCard, team: ScorecardStats["team"]): string | null {
  const r = a.raw;
  switch (axis) {
    case "conversion":
      return r.conversion_pct === null ? null : `Converts ${r.conversion_pct}% of assigned leads${median(team.median.conversion_pct, "%")} — review how leads are qualified`;
    case "followup":
      return r.untouched > 0 ? `${r.untouched} assigned leads still untouched (the oldest has waited ${r.oldest_untouched_days} days) — contact these first` : null;
    case "sales":
      return `Only ${r.sold_90d} policies started in 90 days${median(team.median.sold_90d)}`;
    case "book":
      return `${formatINRCompact(r.premium_in_force)} premium in force${median(team.median.premium_in_force, "₹")} — a smaller book to build on`;
    case "activity":
      return `${r.comms_30d} client contacts logged in 30 days${median(team.median.comms_30d)} — log calls and messages so renewals aren’t missed`;
    case "tasks":
      return r.tasks_done_pct === null ? null : `${r.tasks_done_pct}% of tasks done${r.tasks_overdue ? `, ${r.tasks_overdue} overdue` : ""}${median(team.median.tasks_done_pct, "%")}`;
    case "pace":
      return a.plan?.pace_ratio == null ? null : `Projected at ${Math.round(a.plan.pace_ratio)}% of target${a.plan.needed_per_day ? ` — needs about ${formatINRCompact(a.plan.needed_per_day)} a day for the rest of the period` : ""}`;
  }
}

export function coachingNotes(a: AssociateCard, team: ScorecardStats["team"]): { strengths: string[]; focus: string[] } {
  const entries = (Object.entries(a.pct) as [AxisKey, number | null][]).filter(([, v]) => v !== null) as [AxisKey, number][];
  const strengths = entries
    .filter(([, v]) => v >= STRONG)
    .sort((x, y) => y[1] - x[1])
    .map(([k]) => strength(k, a, team))
    .filter((s): s is string => !!s)
    .slice(0, 3);

  const focusNotes = entries
    .filter(([, v]) => v <= WEAK)
    .sort((x, y) => x[1] - y[1])
    .map(([k]) => focus(k, a, team))
    .filter((s): s is string => !!s);

  // A long-waiting untouched lead is worth flagging even if the overall follow-up rate looks fine.
  if (a.raw.untouched > 0 && a.raw.oldest_untouched_days >= 30 && !focusNotes.some((n) => n.includes("untouched"))) {
    focusNotes.unshift(`${a.raw.untouched} assigned lead${a.raw.untouched === 1 ? " is" : "s are"} still untouched — the oldest has waited ${a.raw.oldest_untouched_days} days`);
  }
  return { strengths, focus: focusNotes.slice(0, 3) };
}
