import { LayoutDashboard, TrendingUp, Users, ShieldAlert, ListChecks, BellRing, type LucideIcon } from "lucide-react";

export const staffNavItems: { label: string; href: string; group?: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/staff", icon: LayoutDashboard },
  { label: "Leads Desk", href: "/staff/leads", group: "Pipeline", icon: TrendingUp },
  { label: "My Clients", href: "/staff/clients", group: "Pipeline", icon: Users },
  { label: "Claim Desk", href: "/staff/claims", group: "Pipeline", icon: ShieldAlert },
  { label: "Intimations", href: "/staff/intimations", group: "Pipeline", icon: BellRing },
  { label: "My Tasks", href: "/staff/tasks", group: "Work", icon: ListChecks },
];
