export type Role = "admin" | "staff" | "associate" | "client";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
}
