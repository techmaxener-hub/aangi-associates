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
import { ChartCard, CountUp, DonutChart } from "../../components/charts/charts";
import { C, RAMP, tint } from "../../components/charts/palette";
import { formatINRCompact } from "../../lib/format";

const ADVISOR_WHATSAPP =
  "https://wa.me/919033132791?text=Hi%20Aangi%20Associates%2C%20I%27d%20like%20to%20talk%20to%20my%20advisor.";

export function ClientDashboard() {
  const { client, policies, loading } = useMyClient();
  const [docs, setDocs] = useState<ClientDocument[]>([]);

  useEffect(() => {
    if (!client) return;
    void api.get<ClientDocument[]>(`/documents.php?client_id=${client.id}`).then((rows) => setDocs(rows ?? []));
  }, [client]);

  // Portfolio summary: active policies only. Mutual Fund amounts are monthly SIPs,
  // so they are left out of the annual-premium figure rather than added to it.
  const active = policies.filter((p) => p.status === "active");
  const totalCover = active.reduce((a, p) => a + (p.sum_assured ?? 0), 0);
  const annualPremium = active.filter((p) => p.product_type !== "Mutual Fund").reduce((a, p) => a + (p.premium ?? 0), 0);
  const upcoming = active
    .filter((p) => p.renewal_date && (daysUntil(p.renewal_date) ?? -1) >= 0)
    .sort((a, b) => ((a.renewal_date ?? "") < (b.renewal_date ?? "") ? -1 : 1))[0];
  const byProduct = Object.entries(active.reduce<Record<string, number>>((m, p) => ({ ...m, [p.product_type]: (m[p.product_type] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const productSlices = byProduct.map(([label, value], i) => ({ label, value, color: RAMP[Math.min(i, RAMP.length - 1)] }));
  const nextDays = upcoming ? daysUntil(upcoming.renewal_date) : null;

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
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="My cover at a glance" subtitle={`${active.length} active ${active.length === 1 ? "policy" : "policies"}`} className="lg:col-span-2">
              <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
                <DonutChart
                  slices={productSlices}
                  size={150}
                  thickness={5}
                  centerValue={String(active.length)}
                  centerLabel="active"
                  layout="stack"
                  ariaLabel={`Active policies by type: ${productSlices.map((x) => `${x.label} ${x.value}`).join(", ")}`}
                />
                <dl className="space-y-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: tint(C.blue, 10) }}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">Total sum assured</dt>
                    <dd className="font-mono text-2xl font-semibold tabular-nums text-text"><CountUp value={totalCover} format={formatINRCompact} /></dd>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: tint(C.navy, 6) }}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">Annual insurance premium</dt>
                    <dd className="font-mono text-2xl font-semibold tabular-nums text-text"><CountUp value={annualPremium} format={formatINRCompact} /></dd>
                  </div>
                </dl>
              </div>
            </ChartCard>
            <ChartCard title="Next renewal" subtitle="Your soonest premium due date">
              {upcoming && nextDays !== null ? (
                <div className="text-center">
                  <p className="font-mono text-5xl font-semibold tabular-nums" style={{ color: nextDays <= 30 ? C.red : C.blue }}>{nextDays}</p>
                  <p className="text-sm text-text-soft">{nextDays === 1 ? "day" : "days"} to go</p>
                  <p className="mt-3 font-medium text-text">{upcoming.product_type}</p>
                  <p className="text-xs text-text-soft">{formatDate(upcoming.renewal_date)}</p>
                </div>
              ) : (
                <EmptyState message="No upcoming renewals." icon={ShieldCheck} />
              )}
            </ChartCard>
          </div>
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
        </>
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
