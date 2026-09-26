import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Card } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { ListSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { formatDate } from "../../lib/format";
import { CLAIM_STAGES, type Claim } from "../clients/types";

export function ClaimsQueuePage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { showToast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Claim[]>("/claims.php");
      setClaims(data ?? []);
    } catch (err) {
      showToast(`Failed to load claims: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advanceStage(claim: Claim, stage: Claim["stage"]) {
    try {
      await api.put(`/claims.php?id=${claim.id}`, {
        stage,
        settled_at: stage === "settled" ? new Date().toISOString() : null,
      });
    } catch (err) {
      showToast(`Failed to update claim: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    void load();
  }

  const visible = filter === "active" ? claims.filter((c) => c.stage !== "settled") : claims;

  return (
    <PortalLayout title="Claim Desk" navItems={navItems}>
      <div className="mb-4 flex gap-2">
        {(["active", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-xs font-mono capitalize ${
              filter === f ? "border-navy bg-navy text-on-navy" : "border-line-strong bg-surface text-text"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState message="No claims to show." icon={ShieldAlert} />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <Link to={`${basePath}/clients/${c.client_id}`} className="font-medium text-text hover:underline">
                    {c.clients?.full_name ?? "Client"}
                  </Link>
                  <p className="text-xs text-text-soft">
                    {c.clients?.phone} · Notified {formatDate(c.notified_at)}
                  </p>
                </div>
                <Select
                  value={c.stage}
                  onChange={(e) => void advanceStage(c, e.target.value as Claim["stage"])}
                  className="w-48"
                >
                  {CLAIM_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              {c.notes && <p className="text-sm text-text">{c.notes}</p>}
              <div className="mt-2 flex gap-1">
                {CLAIM_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded ${CLAIM_STAGES.indexOf(c.stage) >= i ? "bg-gold" : "bg-surface-2"}`}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
