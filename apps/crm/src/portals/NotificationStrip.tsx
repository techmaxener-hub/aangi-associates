import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../auth/useAuth";
import { Card } from "../components/ui/card";
import { localDateISO } from "../lib/format";

// Reads real counts for the signed-in user. The PHP endpoints scope
// associates to their own rows server-side, but admin/staff get the full
// list back from each endpoint — so "my tasks due today" / "my leads"
// are filtered by assigned_to === profile.id here client-side regardless
// of role, since every role (including admin) wants their own, not
// everyone's. Renewals-this-week has no owner concept, so no filter.
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

      const [tasks, leads, policies] = await Promise.all([
        api.get<{ assigned_to: string | null; status: string; due_date: string | null }[]>("/tasks.php"),
        api.get<{ assigned_to: string | null; status: string }[]>("/leads.php"),
        api.get<{ status: string; renewal_date: string | null }[]>("/client_policies.php"),
      ]);

      setTasksDueToday(
        (tasks ?? []).filter((t) => t.assigned_to === profile!.id && t.status !== "done" && t.due_date === today)
          .length,
      );
      setLeadsNeedingAction(
        (leads ?? []).filter(
          (l) => l.assigned_to === profile!.id && ["new", "contacted", "qualified"].includes(l.status),
        ).length,
      );
      setRenewalsThisWeek(
        (policies ?? []).filter(
          (p) => p.status === "active" && p.renewal_date && p.renewal_date >= today && p.renewal_date <= sevenDaysOut,
        ).length,
      );
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
