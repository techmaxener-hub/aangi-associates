import { PortalLayout } from "../PortalLayout";
import { staffNavItems } from "./nav";

export function StaffDashboard() {
  return (
    <PortalLayout title="Staff Dashboard" navItems={staffNavItems}>
      <p className="text-text-soft">Client CRM, the claim desk, and your assigned tasks — pick a section from the left.</p>
    </PortalLayout>
  );
}
