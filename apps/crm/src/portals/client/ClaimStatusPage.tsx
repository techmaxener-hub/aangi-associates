import { PortalLayout } from "../PortalLayout";
import { clientNavItems } from "./nav";
import { NotLinkedNotice } from "./ClientDashboard";
import { useMyClient } from "../../modules/clientPortal/useMyClient";
import { Card } from "../../components/ui/card";
import { formatDate } from "../../lib/format";
import { CLAIM_STAGES } from "../../modules/clients/types";

export function ClaimStatusPage() {
  const { client, claims, loading } = useMyClient();

  return (
    <PortalLayout title="Claim Status" navItems={clientNavItems}>
      {loading ? (
        <p className="text-text-soft">Loading…</p>
      ) : !client ? (
        <NotLinkedNotice />
      ) : claims.length === 0 ? (
        <p className="text-text-soft">No claims on file — hopefully it stays that way.</p>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Card key={c.id} className="p-4">
              <p className="text-sm text-text-soft">Notified {formatDate(c.notified_at)}</p>
              <p className="mb-2 text-lg font-semibold capitalize text-text">{c.stage.replace("_", " ")}</p>
              <div className="flex gap-1">
                {CLAIM_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded ${CLAIM_STAGES.indexOf(c.stage) >= i ? "bg-gold" : "bg-surface-2"}`}
                  />
                ))}
              </div>
              {c.notes && <p className="mt-2 text-sm text-text">{c.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
