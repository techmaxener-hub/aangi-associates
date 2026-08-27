import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PortalLayout } from "../../portals/PortalLayout";
import type { Client } from "./types";

interface NavItem {
  label: string;
  href: string;
}

export function ClientsListPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", city: "", household_name: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = profile?.role === "admin" || profile?.role === "staff";

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (error) showToast(`Failed to load clients: ${error.message}`, "error");
    setClients(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("clients").insert({
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      city: form.city || null,
      household_name: form.household_name || null,
      owner_id: profile?.role === "associate" ? profile.id : null,
    });
    setSaving(false);
    if (error) {
      showToast(`Failed to add client: ${error.message}`, "error");
      return;
    }
    showToast("Client added.");
    setForm({ full_name: "", phone: "", email: "", city: "", household_name: "" });
    setShowForm(false);
    void load();
  }

  return (
    <PortalLayout title="Clients" navItems={navItems}>
      {canCreate && (
        <div className="mb-4">
          <Button onClick={() => setShowForm((v) => !v)}>
            <UserPlus className="h-4 w-4" /> {showForm ? "Cancel" : "Add Client"}
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="mb-6 max-w-xl">
          <form onSubmit={(e) => void handleAdd(e)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-name">Full Name</Label>
              <Input id="c-name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
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
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
        <p className="text-text-soft">Loading…</p>
      ) : clients.length === 0 ? (
        <p className="text-text-soft">No clients yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">City</th>
                <th className="px-4 py-2.5">Household</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium text-text">{c.full_name}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.phone}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.city ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.household_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to={`${basePath}/clients/${c.id}`} className="text-sm font-medium text-gold-text hover:underline">
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
