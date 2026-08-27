import { PortalLayout } from "../PortalLayout";
import { NotificationStrip } from "../NotificationStrip";
import { staffNavItems } from "./nav";

export function StaffDashboard() {
  return (
    <PortalLayout title="Staff Dashboard" navItems={staffNavItems}>
      <NotificationStrip tasksHref="/staff/tasks" leadsHref="/staff/leads" clientsHref="/staff/clients" />
      <p className="text-text-soft">
        Client CRM, the claim desk, and your assigned tasks — pick a section from the left.
      </p>
    </PortalLayout>
  );
}
