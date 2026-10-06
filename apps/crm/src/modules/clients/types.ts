export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  household_name: string | null;
  owner_id: string | null;
  portal_user_id: string | null;
  date_of_birth: string | null; // used only by cron/birthday_wishes.php — never required
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
  category_id: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  created_at: string;
}

// The row shape the new policy-centric "My Clients" page lists — one row
// per policy, joined with its client and advisor names server-side
// (client_policies.php's ?list=1 mode) so the page never needs a second
// round-trip per row just to show who a policy belongs to.
export interface PolicyListRow extends ClientPolicy {
  client_name: string;
  client_phone: string;
  client_email: string | null;
  advisor_name: string | null;
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

// Mirrors policy_extract.php's response — a best-effort read of an
// uploaded policy PDF, always shown as an editable, pre-filled form for a
// human to check, never auto-saved.
export interface PolicyExtractResult {
  low_confidence: boolean;
  fields_found: number;
  fields: {
    insurer: string | null;
    product_type: string | null;
    policy_number: string | null;
    sum_assured: number | null;
    premium: number | null;
    start_date: string | null;
    renewal_date: string | null;
    insured_name: string | null;
  };
  text_preview: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by_name: string | null;
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
  // Added for the "My Clients" policy-list tabs/filters — a CBA practice
  // commonly cross-refers banking products too, not just insurance/MF.
  "Credit Card",
  "Overdraft",
  "Personal Loan",
  "Mortgage Loan",
  "Home Loan",
];

// Coarse grouping for the "My Clients" page's tabs — every PRODUCT_TYPES
// value maps to exactly one of these. Kept separate from Business
// Planning's CATEGORY_MAP (ClientDetailPage.tsx) on purpose: that one
// groups by sales-target category ("Wealth & Guaranteed Solutions" etc.),
// this one groups by the plain product-family language the "My Clients"
// list uses ("Life Insurance", "Health Insurance", ...).
export const POLICY_TABS = [
  "Life Insurance",
  "General Insurance",
  "Health Insurance",
  "Mutual Fund",
  "Credit Card",
  "Overdraft",
  "Personal Loan",
  "Mortgage Loan",
  "Home Loan",
] as const;
export type PolicyTab = (typeof POLICY_TABS)[number];

export const PRODUCT_TYPE_TO_POLICY_TAB: Record<string, PolicyTab> = {
  "Pure Term Plan": "Life Insurance",
  "Guaranteed Return Plan": "Life Insurance",
  "Child Education Plan": "Life Insurance",
  "Pension/Annuity": "Life Insurance",
  "Keyman Insurance": "Life Insurance",
  "Family Mediclaim": "Health Insurance",
  "Critical Illness Cover": "Health Insurance",
  "Group Health Cover": "Health Insurance",
  "General Insurance": "General Insurance",
  "Mutual Fund": "Mutual Fund",
  "Credit Card": "Credit Card",
  Overdraft: "Overdraft",
  "Personal Loan": "Personal Loan",
  "Mortgage Loan": "Mortgage Loan",
  "Home Loan": "Home Loan",
};
