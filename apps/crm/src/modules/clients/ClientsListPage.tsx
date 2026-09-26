import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Download, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { downloadCsv } from "../../lib/csv";
import { formatDate } from "../../lib/format";
import type { Client } from "./types";

export function ClientsListPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [lastContact, setLastContact] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", city: "", household_name: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = profile?.role === "admin" || profile?.role === "staff";

  async function load() {
    setLoading(true);
    try {
      const [clientRows, lastContactRows] = await Promise.all([
        api.get<Client[]>("/clients.php"),
        api.get<{ client_id: string; last_contact: string }[]>("/communications.php?last_per_client=1"),
      ]);
      setClients(clientRows ?? []);
      const map: Record<string, string> = {};
      (lastContactRows ?? []).forEach((r) => {
        map[r.client_id] = r.last_contact;
      });
      setLastContact(map);
    } catch (err) {
      showToast(`Failed to load clients: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/clients.php", {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        city: form.city || null,
        household_name: form.household_name || null,
        owner_id: profile?.role === "associate" ? profile.id : null,
      });
    } catch (err) {
      setSaving(false);
      showToast(`Failed to add client: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    showToast("Client added.");
    setForm({ full_name: "", phone: "", email: "", city: "", household_name: "" });
    setShowForm(false);
    void load();
  }

  function exportCsv() {
    downloadCsv(
      "clients.csv",
      ["Name", "Phone", "Email", "City", "Household", "Created"],
      clients.map((c) => [c.full_name, c.phone, c.email, c.city, c.household_name, formatDate(c.created_at)]),
    );
  }

  return (
    <PortalLayout title="Clients" navItems={navItems}>
      <div className="mb-4 flex flex-wrap gap-2">
        {canCreate && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <UserPlus className="h-4 w-4" /> {showForm ? "Cancel" : "Add Client"}
          </Button>
        )}
        {clients.length > 0 && (
          <Button variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6 max-w-xl">
          <form onSubmit={(e) => void handleAdd(e)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-name">Full Name</Label>
              <Input
                id="c-name"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                type="tel"
                required
                pattern="[0-9+\-\s()]{7,15}"
                title="Enter a valid phone number (7-15 digits)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-household">Household Name</Label>
              <Input
                id="c-household"
                placeholder="e.g. Patel Family"
                value={form.household_name}
                onChange={(e) => setForm({ ...form, household_name: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Client"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <TableSkeleton cols={5} />
      ) : clients.length === 0 ? (
        <EmptyState message="No clients yet." icon={Users} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">City</th>
                <th className="px-4 py-2.5">Household</th>
                <th className="px-4 py-2.5">Last Contact</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-line odd:bg-surface-2/40 hover:bg-surface-2 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-text">{c.full_name}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.phone}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.city ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.household_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const last = lastContact[c.id];
                      if (!last) return <span className="text-text-soft">Never</span>;
                      const days = Math.floor((Date.now() - new Date(last).getTime()) / (24 * 60 * 60 * 1000));
                      return (
                        <span className={days > 60 ? "text-crimson" : "text-text-soft"}>
                          {days <= 0 ? "Today" : `${days}d ago`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      to={`${basePath}/clients/${c.id}`}
                      className="text-sm font-medium text-gold-text hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
