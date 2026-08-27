import { PortalLayout } from "../PortalLayout";
import { associateNavItems } from "./nav";

export function AssociateDashboard() {
  return (
    <PortalLayout title="Associate Dashboard" navItems={associateNavItems}>
      <p className="text-text-soft">Visibility scoped to your own clients and tasks — pick a section from the left.</p>
    </PortalLayout>
  );
}
