import { PortalLayout } from "../PortalLayout";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Associates & Staff", href: "/admin/team" },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminDashboard() {
  return (
    <PortalLayout title="Admin Dashboard" navItems={navItems}>
      <p className="text-text-soft">
        Full visibility across clients, associates, staff, and settings. Client CRM, onboarding tracks, task
        allotment, and admin settings modules land here in the next build step.
      </p>
    </PortalLayout>
  );
}
