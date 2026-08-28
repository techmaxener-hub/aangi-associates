import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/useAuth";
import { Card } from "../components/ui/card";
import { localDateISO } from "../lib/format";

// Reads real, role-scoped counts for the signed-in user — RLS already
// restricts each query to what this role/user can see (an Associate's
// client_policies query only ever returns their own clients' policies,
// for example), so this component needs no role branching of its own.
export function NotificationStrip({
  tasksHref,
  leadsHref,
  clientsHref,
}: {
  tasksHref: string;
  leadsHref: string;
  clientsHref: string;
}) {
  const { profile } = useAuth();
  const [tasksDueToday, setTasksDueToday] = useState<number | null>(null);
  const [leadsNeedingAction, setLeadsNeedingAction] = useState<number | null>(null);
  const [renewalsThisWeek, setRenewalsThisWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;

    async function load() {
      const now = new Date();
      const today = localDateISO(now);
      const sevenDaysOut = localDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

      const [tasks, leads, renewals] = await Promise.all([
        supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", profile!.id)
          .neq("status", "done")
          .eq("due_date", today),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", profile!.id)
          .in("status", ["new", "contacted", "qualified"]),
        supabase
          .from("client_policies")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .gte("renewal_date", today)
          .lte("renewal_date", sevenDaysOut),
      ]);

      setTasksDueToday(tasks.count ?? 0);
      setLeadsNeedingAction(leads.count ?? 0);
      setRenewalsThisWeek(renewals.count ?? 0);
    }
    void load();
  }, [profile]);

  const items = [
    { label: "Tasks Due Today", value: tasksDueToday, href: tasksHref },
    { label: "Leads Needing Action", value: leadsNeedingAction, href: leadsHref },
    { label: "Renewals This Week", value: renewalsThisWeek, href: clientsHref },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <Link key={item.label} to={item.href}>
          <Card className="flex items-center justify-between p-4 transition-colors hover:border-line-strong">
            <p className="text-sm text-text-soft">{item.label}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-text">{item.value ?? "…"}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
