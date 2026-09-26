export interface ProductCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: 0 | 1;
}

export type PeriodType = "day" | "range" | "month" | "quarter" | "year";

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  day: "Single Day",
  range: "Date Range",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

// The single place that turns "day / range / month / quarter / year" plus
// whatever the period form collected into concrete start_date/end_date +
// a human label — used by the New/Edit Plan form and by "copy previous
// period" (which needs to compute the *next* period's dates from a plan's
// current ones).
export function computePeriodDates(
  periodType: PeriodType,
  input: {
    date?: string;
    rangeStart?: string;
    rangeEnd?: string;
    month?: string;
    year?: number;
    quarter?: 1 | 2 | 3 | 4;
  },
): { start_date: string; end_date: string; period_label: string } | null {
  switch (periodType) {
    case "day": {
      if (!input.date) return null;
      return {
        start_date: input.date,
        end_date: input.date,
        period_label: new Date(input.date + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      };
    }
    case "range": {
      if (!input.rangeStart || !input.rangeEnd) return null;
      const fmt = (d: string) =>
        new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      return {
        start_date: input.rangeStart,
        end_date: input.rangeEnd,
        period_label: `${fmt(input.rangeStart)} – ${fmt(input.rangeEnd)}`,
      };
    }
    case "month": {
      if (!input.month) return null; // "YYYY-MM" from <input type="month">
      const [y, m] = input.month.split("-").map(Number);
      return {
        start_date: ymd(y, m, 1),
        end_date: ymd(y, m, lastDayOfMonth(y, m)),
        period_label: `${MONTH_NAMES[m - 1]} ${y}`,
      };
    }
    case "quarter": {
      if (!input.year || !input.quarter) return null;
      const startMonth = (input.quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return {
        start_date: ymd(input.year, startMonth, 1),
        end_date: ymd(input.year, endMonth, lastDayOfMonth(input.year, endMonth)),
        period_label: `Q${input.quarter} ${input.year}`,
      };
    }
    case "year": {
      if (!input.year) return null;
      return { start_date: ymd(input.year, 1, 1), end_date: ymd(input.year, 12, 31), period_label: String(input.year) };
    }
  }
}

export type CommissionType = "percent" | "flat_per_policy";

export interface PlanTarget {
  id: string;
  plan_id: string;
  category_id: string;
  category_name: string;
  expected_premium: number | null;
  expected_policy_count: number | null;
  commission_type: CommissionType;
  commission_value: number;
  // Present on every target returned by the API — computed live server-side,
  // never entered by hand.
  achieved_premium: number;
  achieved_count: number;
  commission_earned: number;
  commission_expected: number;
}

export interface BusinessPlan {
  id: string;
  associate_id: string;
  associate_name: string;
  associate_email: string | null;
  period_type: PeriodType;
  period_label: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  viewed_at: string | null;
  created_at: string;
  updated_at: string;
  targets: PlanTarget[];
}

export interface ConsolidatedAssociateRow {
  associate_id: string;
  associate_name: string;
  plan_count: number;
  expected_premium: number;
  achieved_premium: number;
  expected_count: number;
  achieved_count: number;
  commission_expected: number;
  commission_earned: number;
}

export interface ConsolidatedCategoryRow {
  category_id: string;
  category_name: string;
  expected_premium: number;
  achieved_premium: number;
}

export interface ConsolidatedReport {
  start_date: string;
  end_date: string;
  associates: ConsolidatedAssociateRow[];
  by_category: ConsolidatedCategoryRow[];
}

// Sums a plan's per-category targets into one headline number — used by
// dashboard cards, plan-list cards, and the pacing badge, so all three
// agree on what "the plan's overall %" means.
export function planTotals(plan: BusinessPlan) {
  return plan.targets.reduce(
    (acc, t) => ({
      expected: acc.expected + (t.expected_premium ?? 0),
      achieved: acc.achieved + t.achieved_premium,
      commissionExpected: acc.commissionExpected + t.commission_expected,
      commissionEarned: acc.commissionEarned + t.commission_earned,
    }),
    { expected: 0, achieved: 0, commissionExpected: 0, commissionEarned: 0 },
  );
}

export type PacingStatus = "exceeded" | "on_track" | "behind";

export const PACING_LABEL: Record<PacingStatus, string> = {
  exceeded: "Exceeded",
  on_track: "On Track",
  behind: "Behind Pace",
};

export const PACING_BADGE_VARIANT: Record<PacingStatus, "success" | "neutral" | "critical"> = {
  exceeded: "success",
  on_track: "neutral",
  behind: "critical",
};

// Compares %-of-target achieved against %-of-period elapsed, with a small
// grace margin so a plan isn't flagged "behind" the moment it's created.
export function pacingStatus(plan: BusinessPlan): PacingStatus {
  const { expected, achieved } = planTotals(plan);
  if (expected <= 0) return "on_track";
  const achievedPct = achieved / expected;
  if (achievedPct >= 1) return "exceeded";

  const start = new Date(plan.start_date).getTime();
  const end = new Date(plan.end_date).getTime();
  const now = Date.now();
  const totalDays = Math.max(1, (end - start) / 86400000);
  const elapsedDays = Math.min(totalDays, Math.max(0, (now - start) / 86400000));
  const elapsedPct = elapsedDays / totalDays;

  return achievedPct + 0.1 >= elapsedPct ? "on_track" : "behind";
}
