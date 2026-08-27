import { PortalLayout } from "../PortalLayout";

const navItems = [
  { label: "Dashboard", href: "/staff" },
  { label: "Clients", href: "/staff/clients" },
  { label: "Claim Desk", href: "/staff/claims" },
  { label: "My Tasks", href: "/staff/tasks" },
];

export function StaffDashboard() {
  return (
    <PortalLayout title="Staff Dashboard" navItems={navItems}>
      <p className="text-text-soft">
        Client CRM and claim desk access, plus assigned tasks. Modules land here in the next build step.
      </p>
    </PortalLayout>
  );
}
