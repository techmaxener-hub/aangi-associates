// Shape of GET /api/scorecard.php (apps/crm-api/lib/scorecard_data.php).
export type AxisKey = "conversion" | "followup" | "sales" | "book" | "activity" | "tasks" | "pace";

export interface AxisMeta {
  key: AxisKey;
  label: string;
  help: string;
}

export type PaceStatus = "met" | "on_pace" | "slightly_behind" | "behind" | "early" | "no_target";

export interface PlanProgress {
  id: string;
  label: string;
  start: string;
  end: string;
  expected: number;
  achieved: number;
  total_days: number;
  elapsed_days: number;
  projected: number | null;
  pace: PaceStatus;
  daily: number[];
  needed_per_day: number | null;
  pace_ratio: number | null;
}

export interface AssociateRaw {
  leads: number;
  contacted: number;
  converted: number;
  untouched: number;
  oldest_untouched_days: number;
  clients: number;
  active_policies: number;
  premium_in_force: number;
  sold_30d: number;
  sold_90d: number;
  comms_30d: number;
  tasks: number;
  tasks_done: number;
  tasks_overdue: number;
  conversion_pct: number | null;
  contacted_pct: number | null;
  tasks_done_pct: number | null;
}

export interface AssociateCard {
  id: string;
  name: string;
  raw: AssociateRaw;
  pct: Record<AxisKey, number | null>;
  score: number | null;
  plan: PlanProgress | null;
}

export interface ScorecardStats {
  today: string;
  rules: { min_sample: number; min_axes: number; min_elapsed_pct: number };
  axes: AxisMeta[];
  team: {
    associates: number;
    with_plan: number;
    median: Record<"conversion_pct" | "contacted_pct" | "sold_90d" | "premium_in_force" | "comms_30d" | "tasks_done_pct", number | null>;
    plan: { expected: number; achieved: number; projected: number; behind: number; on_pace: number; early: number };
  };
  associates: AssociateCard[];
}
