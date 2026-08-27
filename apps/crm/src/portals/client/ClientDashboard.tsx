import { PortalLayout } from "../PortalLayout";

const navItems = [
  { label: "My Policies", href: "/client" },
  { label: "Claim Status", href: "/client/claims" },
  { label: "Renewals", href: "/client/renewals" },
];

export function ClientDashboard() {
  return (
    <PortalLayout title="My Policies" navItems={navItems}>
      <p className="text-text-soft">
        Your policy documents, claim status tracker, and renewal dates land here in the next build step.
      </p>
    </PortalLayout>
  );
}
