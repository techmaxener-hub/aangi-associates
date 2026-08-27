import { PortalLayout } from "../PortalLayout";
import { adminNavItems } from "./nav";

export function AdminDashboard() {
  return (
    <PortalLayout title="Admin Dashboard" navItems={adminNavItems}>
      <p className="text-text-soft">
        Full visibility across clients, associates, staff, and settings. Client CRM, onboarding tracks, task
        allotment, and admin settings modules land here in the next build step.
      </p>
    </PortalLayout>
  );
}
