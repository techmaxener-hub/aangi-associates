import { useEffect, useState } from "react";
import { Target, Download, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { DashboardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout } from "../../portals/PortalLayout";
import { associateNavItems } from "../../portals/associate/nav";
import { PERIOD_TYPE_LABEL, planTotals, type BusinessPlan } from "./types";
import { PacingBadge, PlanOverallProgress, PlanTargetsBreakdown } from "./components";
import { exportPlanPdf } from "./exportPlanPdf";
import { exportPlanExcel } from "./exportPlanExcel";

// Read-only by design — the associate can see everything about their own
// plan (admin sets it, admin edits it) but has no create/edit/delete
// affordance here, matching the spec ("admin can edit anytime but
// associate can't").
export function AssociateBusinessPlanPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BusinessPlan[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rows = (await api.get<BusinessPlan[]>("/business_plans.php")) ?? [];
        setPlans(rows);
        // Stamp "seen" on whichever plan is current (covers today), if any
        // — lets admin know the associate actually opened this page.
        const today = new Date().toISOString().slice(0, 10);
        const current = rows.find((p) => p.start_date <= today && p.end_date >= today && !p.viewed_at);
        if (current) void api.put(`/business_plans.php?id=${current.id}&action=view`, {});
      } catch (err) {
        showToast(
          `Failed to load your business plan: ${err instanceof ApiError ? err.message : "unknown error"}`,
          "error",
        );
      }
      setLoading(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalLayout title="My Business Plan" navItems={associateNavItems}>
      {loading ? (
        <DashboardSkeleton />
      ) : plans.length === 0 ? (
        <EmptyState
          message="No business plan has been set for you yet — check back once your admin creates one."
          icon={Target}
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const totals = planTotals(plan);
            const expanded = expandedId === plan.id || plans.length === 1;
            return (
              <Card key={plan.id} interactive>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base text-text">{plan.period_label}</h3>
                      <PacingBadge plan={plan} />
                    </div>
                    <p className="text-xs text-text-soft">
                      {PERIOD_TYPE_LABEL[plan.period_type]}
                      {totals.commissionEarned > 0 && (
                        <> · Commission earned so far: ₹{Math.round(totals.commissionEarned).toLocaleString("en-IN")}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => void exportPlanPdf(plan)}>
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void exportPlanExcel(plan)}>
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                    </Button>
                    {plans.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : plan.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-text-soft hover:bg-surface-2"
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <PlanOverallProgress plan={plan} />
                </div>
                {expanded && (
                  <div className="mt-4">
                    <PlanTargetsBreakdown targets={plan.targets} />
                    {plan.notes && <p className="mt-3 text-sm text-text-soft">Note from admin: {plan.notes}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
