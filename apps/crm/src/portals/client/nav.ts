import { ShieldCheck, ShieldAlert, CalendarClock, type LucideIcon } from "lucide-react";

export const clientNavItems: { label: string; href: string; group?: string; icon: LucideIcon }[] = [
  { label: "My Policies", href: "/client", icon: ShieldCheck },
  { label: "Claim Status", href: "/client/claims", icon: ShieldAlert },
  { label: "Renewals", href: "/client/renewals", icon: CalendarClock },
];
