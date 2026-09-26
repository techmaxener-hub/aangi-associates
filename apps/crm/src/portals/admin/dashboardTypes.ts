// Shape of GET /api/dashboard.php (apps/crm-api/lib/dashboard_data.php).
export interface KpiStat {
  value: number;
  last_30d: number;
  change_pct: number | null;
  weekly: number[]; // 12 weekly buckets, oldest → newest
}

export interface SegmentStat {
  name: string;
  policies: number;
  clients: number;
  premium: number;
  premium_kind: "annual" | "monthly_sip";
}

export interface NewBusinessMonth {
  month: string; // YYYY-MM
  segments: Record<string, { count: number; premium: number }>;
}

export interface RenewalMonth {
  month: string;
  count: number;
  premium: number;
}

export interface UpcomingRenewal {
  id: string;
  product_type: string;
  renewal_date: string;
  premium: string | number | null;
  client_id: string;
  client_name: string;
}

export interface TopAssociate {
  id: string;
  name: string;
  clients: number;
  policies: number;
  premium: number;
  leads: number;
  converted: number;
}

export interface DashboardStats {
  generated_at: string;
  today: string;
  kpis: {
    clients: KpiStat;
    active_policies: KpiStat;
    open_claims: KpiStat;
    leads_30d: KpiStat;
  };
  portfolio: {
    premium_in_force: number;
    sip_monthly: number;
    insurance_policies: number;
    policy_status: { active: number; lapsed: number; matured: number };
    segments: SegmentStat[];
    new_business: NewBusinessMonth[];
  };
  leads: {
    total: number;
    conversion_pct: number;
    by_status: Record<"new" | "contacted" | "qualified" | "converted" | "dropped", number>;
    by_source: Record<string, number>;
    by_type: Record<string, number>;
    weekly_created: number[];
    weekly_converted: number[];
  };
  claims: { by_stage: Record<"notified" | "documentation" | "insurer_liaison" | "settled", number> };
  renewals: { by_month: RenewalMonth[]; next_60d_count: number; upcoming: UpcomingRenewal[] };
  tasks: { by_status: Record<"todo" | "in_progress" | "done", number>; overdue: number; due_today: number };
  top_associates: TopAssociate[];
  action_items: {
    tasks: { id: string; title: string; due_date: string }[];
    renewals: { id: string; product_type: string; renewal_date: string; client_id: string; client_name: string }[];
    leads: { id: string; full_name: string; created_at: string }[];
  };
}
