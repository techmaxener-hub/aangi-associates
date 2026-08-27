import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";

const LEAD_TYPES = ["Term", "Mediclaim", "Keyman", "Mutual Funds", "Agent Recruitment"];
const ADVISOR_PHONE = "919033132791";

export function ManualLeadEntry() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    lead_type: LEAD_TYPES[0],
    owner: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("leads").insert({
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      city: form.city || null,
      lead_type: form.lead_type,
      source: "manual",
      owner: form.owner || null,
      notes: form.notes || null,
      created_by: session?.user.id ?? null,
    });

    setSaving(false);

    if (error) {
      showToast(`Failed to save lead: ${error.message}`, "error");
      return;
    }

    const message = [
      "New manual lead captured:",
      `Name: ${form.full_name}`,
      `Phone: ${form.phone}`,
      form.city ? `City: ${form.city}` : null,
      `Interested In: ${form.lead_type}`,
      form.owner ? `Owner: ${form.owner}` : null,
      form.notes ? `Notes: ${form.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(`https://wa.me/${ADVISOR_PHONE}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    showToast("Lead saved and WhatsApp alert opened.");
    setForm({ full_name: "", phone: "", email: "", city: "", lead_type: LEAD_TYPES[0], owner: "", notes: "" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="border-b border-line pb-3">
        <h2 className="flex items-center gap-2 font-display text-base text-text">
          <UserPlus className="h-5 w-5 text-gold" /> Manual Lead Capture
        </h2>
        <p className="text-xs text-text-soft">Record direct inquiries, walk-ins, and referrals for follow-up.</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="lead-name">Full Name</Label>
          <Input id="lead-name" required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="lead-phone">Mobile Number</Label>
          <Input id="lead-phone" type="tel" required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="lead-email">Email</Label>
          <Input id="lead-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="lead-city">City</Label>
          <Input id="lead-city" value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="lead-type">Lead Type</Label>
          <Select id="lead-type" value={form.lead_type} onChange={(e) => update("lead_type", e.target.value)}>
            {LEAD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="lead-owner">Lead Owner</Label>
          <Input id="lead-owner" value={form.owner} onChange={(e) => update("owner", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="lead-notes">Notes</Label>
          <Textarea id="lead-notes" rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Dispatching…" : "Dispatch Lead & Alert WhatsApp"}
          </Button>
        </div>
      </form>
    </div>
  );
}
