export type CandidateTrack = "associate" | "staff";

export interface Candidate {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  occupation: string | null;
  track: CandidateTrack;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
}

export const ASSOCIATE_STAGES = [
  "application",
  "documentation",
  "training",
  "exam",
  "code_issued",
  "days_1_30",
  "days_31_60",
  "days_61_90",
  "active_associate",
];

export const STAFF_STAGES = ["offer", "documentation", "system_access", "week_1_training", "active_staff"];

export function stagesFor(track: CandidateTrack): string[] {
  return track === "associate" ? ASSOCIATE_STAGES : STAFF_STAGES;
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}
