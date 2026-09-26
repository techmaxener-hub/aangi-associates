import { useEffect, useState } from "react";
import { FileText, Download, ShieldCheck } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { clientNavItems } from "./nav";
import { useMyClient } from "../../modules/clientPortal/useMyClient";
import { api, API_BASE } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ListSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { formatINR, formatDate, daysUntil } from "../../lib/format";
import { POLICY_STATUS_VARIANT, type ClientDocument } from "../../modules/clients/types";

const ADVISOR_WHATSAPP =
  "https://wa.me/919033132791?text=Hi%20Aangi%20Associates%2C%20I%27d%20like%20to%20talk%20to%20my%20advisor.";

export function ClientDashboard() {
  const { client, policies, loading } = useMyClient();
  const [docs, setDocs] = useState<ClientDocument[]>([]);

  useEffect(() => {
    if (!client) return;
    void api.get<ClientDocument[]>(`/documents.php?client_id=${client.id}`).then((rows) => setDocs(rows ?? []));
  }, [client]);

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
        <EmptyState message="No policies on file yet." icon={ShieldCheck} />
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

      {client && docs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg text-text">My Documents</h2>
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-gold-text" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text">{d.original_name}</p>
                  <p className="text-xs text-text-soft">{formatDate(d.created_at)}</p>
                </div>
                <a
                  href={`${API_BASE}/documents.php?download=${d.id}`}
                  className="shrink-0 rounded-md p-1.5 text-text-soft hover:bg-surface-2 hover:text-text"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
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
