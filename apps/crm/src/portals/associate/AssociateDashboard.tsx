import { PortalLayout } from "../PortalLayout";

const navItems = [
  { label: "Dashboard", href: "/associate" },
  { label: "My Clients", href: "/associate/clients" },
  { label: "My Candidates", href: "/associate/candidates" },
  { label: "My Tasks", href: "/associate/tasks" },
];

export function AssociateDashboard() {
  return (
    <PortalLayout title="Associate Dashboard" navItems={navItems}>
      <p className="text-text-soft">
        Visibility scoped to your own clients, candidates, and tasks. Modules land here in the next build step.
      </p>
    </PortalLayout>
  );
}
