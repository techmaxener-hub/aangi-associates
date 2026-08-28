export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  household_name: string | null;
  owner_id: string | null;
  portal_user_id: string | null;
  created_at: string;
}

export type PolicyStatus = "active" | "lapsed" | "matured";

export const POLICY_STATUS_VARIANT: Record<PolicyStatus, "success" | "critical" | "neutral"> = {
  active: "success",
  lapsed: "critical",
  matured: "neutral",
};

export interface ClientPolicy {
  id: string;
  client_id: string;
  policy_number: string | null;
  insurer: string;
  product_type: string;
  sum_assured: number | null;
  premium: number | null;
  start_date: string | null;
  renewal_date: string | null;
  status: PolicyStatus;
  created_at: string;
}

export type OpportunityStage = "inquiry" | "quote" | "application" | "underwriting" | "bind_issue";

export interface Opportunity {
  id: string;
  client_id: string;
  product_type: string;
  stage: OpportunityStage;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ClaimStage = "notified" | "documentation" | "insurer_liaison" | "settled";

export interface Claim {
  id: string;
  client_id: string;
  policy_id: string | null;
  stage: ClaimStage;
  notified_at: string;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
  clients?: { full_name: string; phone: string } | null;
}

export type CommChannel = "whatsapp" | "call" | "email" | "other";

export interface Communication {
  id: string;
  client_id: string;
  channel: CommChannel;
  notes: string | null;
  occurred_at: string;
  logged_by: string | null;
  created_at: string;
}

export const OPPORTUNITY_STAGES: OpportunityStage[] = ["inquiry", "quote", "application", "underwriting", "bind_issue"];
export const CLAIM_STAGES: ClaimStage[] = ["notified", "documentation", "insurer_liaison", "settled"];
export const PRODUCT_TYPES = [
  "Pure Term Plan",
  "Critical Illness Cover",
  "Family Mediclaim",
  "Child Education Plan",
  "Guaranteed Return Plan",
  "Mutual Fund",
  "Pension/Annuity",
  "Keyman Insurance",
  "Group Health Cover",
  "General Insurance",
];
