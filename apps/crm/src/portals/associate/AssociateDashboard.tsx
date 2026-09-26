import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout } from "../PortalLayout";
import { NotificationStrip } from "../NotificationStrip";
import { PacingBadge, PlanOverallProgress } from "../../modules/business-planning/components";
import type { BusinessPlan } from "../../modules/business-planning/types";
import { associateNavItems } from "./nav";

export function AssociateDashboard() {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const rows = (await api.get<BusinessPlan[]>("/business_plans.php")) ?? [];
        const today = new Date().toISOString().slice(0, 10);
        setPlan(rows.find((p) => p.start_date <= today && p.end_date >= today) ?? rows[0] ?? null);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err; // a missing plan is not an error worth surfacing here
      }
    }
    void load();
  }, []);

  return (
    <PortalLayout title="Associate Dashboard" navItems={associateNavItems}>
      <NotificationStrip tasksHref="/associate/tasks" leadsHref="/associate/leads" clientsHref="/associate/clients" />

      <Card className="mt-4 p-5" interactive>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg text-text">My Business Plan</h2>
          <Link to="/associate/business-plan" className="text-xs text-gold-text hover:underline">
            View details →
          </Link>
        </div>
        {!plan ? (
          <EmptyState message="No business plan has been set for you yet." icon={Target} />
        ) : (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm text-text">{plan.period_label}</p>
              <PacingBadge plan={plan} />
            </div>
            <PlanOverallProgress plan={plan} />
          </div>
        )}
      </Card>

      <p className="mt-4 text-text-soft">
        Visibility scoped to your own clients and tasks — pick a section from the left.
      </p>
    </PortalLayout>
  );
}
