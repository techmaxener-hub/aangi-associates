import { useEffect, useState } from "react";
import { PartyPopper, CalendarClock, Download, CheckCircle2 } from "lucide-react";
import { api, API_BASE, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { TableSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { formatDate } from "../../lib/format";

// Mirrors intimations.php — the browser-side equivalent of the daily
// PDF/email's "Send via WhatsApp" button. All three (this page, the PDF,
// the email) point at the same dispatch_token redirect, so clicking from
// any of them marks the same item "clicked" — never that the client
// received anything, only that an admin/staff member acted on it.

interface IntimationItem {
  id: string;
  kind: "birthday" | "renewal";
  client_id: string;
  client_name: string;
  client_phone: string;
  policy_id: string | null;
  product_type: string | null;
  renewal_date: string | null;
  clicked_at: string | null;
  redirect_link: string;
}

export function IntimationsPage({ navItems }: { navItems: NavItem[] }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<IntimationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api
      .get<IntimationItem[]>("/intimations.php")
      .then((rows) => setItems(rows ?? []))
      .catch((err) => showToast(`Failed to load: ${err instanceof ApiError ? err.message : "unknown error"}`, "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = items.filter((i) => !i.clicked_at);
  const done = items.filter((i) => i.clicked_at);

  return (
    <PortalLayout title="Intimations" navItems={navItems}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-soft">
          Today's ({today}) birthday wishes and renewal reminders due for review. Pressing "Send via WhatsApp" opens a
          pre-filled chat with that client in a new tab — nothing goes out until you actually send it there.
        </p>
        <Button asChild variant="ghost">
          <a href={`${API_BASE}/intimations.php?pdf=1`} target="_blank" rel="noopener">
            <Download className="h-4 w-4" /> Download Today's PDF
          </a>
        </Button>
      </div>

      {loading ? (
        <TableSkeleton cols={4} />
      ) : items.length === 0 ? (
        <EmptyState message="Nothing due today." icon={CalendarClock} />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">
                Pending ({pending.length})
              </h3>
              <ItemTable rows={pending} />
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">
                Already sent ({done.length})
              </h3>
              <ItemTable rows={done} />
            </section>
          )}
        </div>
      )}
    </PortalLayout>
  );
}

function ItemTable({ rows }: { rows: IntimationItem[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
          <tr>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Client</th>
            <th className="px-4 py-2.5">Detail</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-t border-line odd:bg-surface-2/40">
              <td className="px-4 py-2.5">
                <Badge variant={item.kind === "birthday" ? "warning" : "neutral"}>
                  {item.kind === "birthday" ? (
                    <>
                      <PartyPopper className="h-3 w-3" /> Birthday
                    </>
                  ) : (
                    <>
                      <CalendarClock className="h-3 w-3" /> Renewal
                    </>
                  )}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-medium text-text">{item.client_name}</td>
              <td className="px-4 py-2.5 text-text-soft">
                {item.kind === "birthday"
                  ? "Today is their birthday"
                  : `${item.product_type ?? "Policy"} — due ${item.renewal_date ? formatDate(item.renewal_date) : "—"}`}
              </td>
              <td className="px-4 py-2.5 text-right">
                {item.clicked_at ? (
                  <span className="inline-flex items-center gap-1 text-xs text-text-soft">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Sent {formatDate(item.clicked_at)}
                  </span>
                ) : (
                  <a
                    href={item.redirect_link}
                    target="_blank"
                    rel="noopener"
                    className="text-sm font-medium text-gold-text hover:underline"
                  >
                    Send via WhatsApp →
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
