export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "dropped";

export interface LeadAssignee {
  id: string;
  full_name: string | null;
  role: string;
}

export interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  lead_type: string | null;
  source: string;
  owner: string | null;
  notes: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  converted_client_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  assignee?: LeadAssignee | null;
}

export const LEAD_PIPELINE: LeadStatus[] = ["new", "contacted", "qualified", "converted"];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  dropped: "Dropped",
};
