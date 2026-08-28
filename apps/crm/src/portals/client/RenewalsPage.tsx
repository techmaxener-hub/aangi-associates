import { PortalLayout } from "../PortalLayout";
import { clientNavItems } from "./nav";
import { NotLinkedNotice } from "./ClientDashboard";
import { useMyClient } from "../../modules/clientPortal/useMyClient";
import { Card } from "../../components/ui/card";
import { ListSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { formatDate, daysUntil } from "../../lib/format";

export function RenewalsPage() {
  const { client, policies, loading } = useMyClient();
  const withRenewal = policies
    .filter((p) => p.renewal_date)
    .sort((a, b) => (a.renewal_date! < b.renewal_date! ? -1 : 1));

  return (
    <PortalLayout title="Renewals" navItems={clientNavItems}>
      {loading ? (
        <ListSkeleton rows={2} />
      ) : !client ? (
        <NotLinkedNotice />
      ) : withRenewal.length === 0 ? (
        <EmptyState message="No upcoming renewal dates on file." />
      ) : (
        <div className="space-y-3">
          {withRenewal.map((p) => {
            const dueIn = daysUntil(p.renewal_date);
            const soon = dueIn !== null && dueIn <= 60 && dueIn >= 0;
            return (
              <Card key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-text">{p.product_type}</p>
                  <p className="text-xs text-text-soft">{p.insurer}</p>
                </div>
                <p className={soon ? "font-semibold text-crimson" : "text-text-soft"}>
                  {formatDate(p.renewal_date)}
                  {soon ? ` · ${dueIn} days` : ""}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
