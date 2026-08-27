import { PortalLayout } from "../PortalLayout";
import { NotificationStrip } from "../NotificationStrip";
import { associateNavItems } from "./nav";

export function AssociateDashboard() {
  return (
    <PortalLayout title="Associate Dashboard" navItems={associateNavItems}>
      <NotificationStrip tasksHref="/associate/tasks" leadsHref="/associate/leads" clientsHref="/associate/clients" />
      <p className="text-text-soft">Visibility scoped to your own clients and tasks — pick a section from the left.</p>
    </PortalLayout>
  );
}
