// Shape of GET /api/retention.php (apps/crm-api/lib/retention_data.php).
export interface PipelineSide {
  count: number;
  premium: number;
}

export interface PipelineBucket {
  key: "overdue" | "d30" | "d60" | "d90";
  label: string;
  engaged: PipelineSide;
  not_engaged: PipelineSide;
}

export interface CohortRow {
  active: number;
  lapsed: number;
  matured: number;
  lapse_pct: number | null;
}

export interface Hotspot {
  label: string;
  policies: number;
  lapsed: number;
  lapse_pct: number;
  lapsed_premium: number;
}

export interface WorklistItem {
  policy_id: string;
  client_id: string;
  client_name: string;
  phone: string | null;
  product_type: string;
  premium: number;
  renewal_date: string;
  days_to_renewal: number;
  associate: string | null;
  days_since_contact: number | null;
}

export type HotspotDim = "segment" | "product" | "insurer" | "associate";

export interface RetentionStats {
  today: string;
  rules: { engaged_days: number; min_sample: number };
  summary: {
    due_90d_count: number;
    due_90d_premium: number;
    at_risk_premium: number;
    at_risk_pct: number;
    overdue_count: number;
    overdue_premium: number;
    lapse_pct: number | null;
    lapsed_count: number;
    lapsed_premium: number;
    active_premium: number;
  };
  pipeline: PipelineBucket[];
  by_age: (CohortRow & { label: string })[];
  by_cohort: (CohortRow & { year: string })[];
  hotspots: Record<HotspotDim, Hotspot[]>;
  worklist: WorklistItem[];
}
