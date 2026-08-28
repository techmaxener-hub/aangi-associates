import { PortalLayout } from "../PortalLayout";
import { clientNavItems } from "./nav";
import { useMyClient } from "../../modules/clientPortal/useMyClient";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ListSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { formatINR, formatDate, daysUntil } from "../../lib/format";
import { POLICY_STATUS_VARIANT } from "../../modules/clients/types";

const ADVISOR_WHATSAPP =
  "https://wa.me/919033132791?text=Hi%20Aangi%20Associates%2C%20I%27d%20like%20to%20talk%20to%20my%20advisor.";

export function ClientDashboard() {
  const { client, policies, loading } = useMyClient();

  return (
    <PortalLayout title="My Policies" navItems={clientNavItems}>
      <div className="mb-6">
        <Button asChild>
          <a href={ADVISOR_WHATSAPP} target="_blank" rel="noopener">
            Message My Advisor →
          </a>
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={2} />
      ) : !client ? (
        <NotLinkedNotice />
      ) : policies.length === 0 ? (
        <EmptyState message="No policies on file yet." />
      ) : (
        <div className="space-y-3">
          {policies.map((p) => {
            const dueIn = daysUntil(p.renewal_date);
            const soon = dueIn !== null && dueIn <= 60 && dueIn >= 0;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text">{p.product_type}</p>
                    <p className="text-xs text-text-soft">
                      {p.insurer} {p.policy_number ? `· ${p.policy_number}` : ""}
                    </p>
                  </div>
                  <Badge variant={POLICY_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="text-text-soft">
                    Sum Assured: <span className="font-mono tabular-nums text-text">{formatINR(p.sum_assured)}</span>
                  </p>
                  <p className={soon ? "font-semibold text-crimson" : "text-text-soft"}>
                    Renewal: {formatDate(p.renewal_date)}
                    {soon ? ` (${dueIn}d)` : ""}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}

export function NotLinkedNotice() {
  return (
    <Card className="max-w-lg p-4 text-sm text-text-soft">
      We're still setting up your portal access. If you've just logged in for the first time, this usually resolves
      within a few minutes — otherwise, please message your advisor and we'll get it sorted.
    </Card>
  );
}
