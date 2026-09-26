import { LayoutDashboard, TrendingUp, Users, ListChecks, Target, type LucideIcon } from "lucide-react";

export const associateNavItems: { label: string; href: string; group?: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/associate", icon: LayoutDashboard },
  { label: "My Leads", href: "/associate/leads", group: "My Work", icon: TrendingUp },
  { label: "My Clients", href: "/associate/clients", group: "My Work", icon: Users },
  { label: "My Tasks", href: "/associate/tasks", group: "My Work", icon: ListChecks },
  { label: "My Business Plan", href: "/associate/business-plan", group: "My Work", icon: Target },
];
