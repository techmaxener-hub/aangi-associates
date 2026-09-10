import { useEffect, useState, type FormEvent } from "react";
import { PhoneOutgoing, Plus } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { Badge, type BadgeVariant } from "../../../components/ui/badge";
import { TableSkeleton } from "../../../components/ui/skeleton";
import { EmptyState } from "../../../components/ui/empty-state";
import { formatDate } from "../../../lib/format";

type IntentScore = "high" | "medium" | "low" | null;

interface CallRow {
  id: string;
  lead_name: string;
  phone: string;
  source_channel: string | null;
  language_detected: string | null;
  duration_seconds: number | null;
  intent_score: IntentScore;
  status: string;
  recording_url: string | null;
  notes: string | null;
  created_at: string;
}

const ADVISOR_PHONE = "919033132791";

const INTENT_VARIANT: Record<string, BadgeVariant> = {
  high: "critical",
  medium: "warning",
  low: "neutral",
};

export function CallLogsDesk() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    lead_name: "",
    phone: "",
    source_channel: "Manual",
    language_detected: "Indian English",
    duration_seconds: "",
    intent_score: "medium" as NonNullable<IntentScore>,
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      setCalls((await api.get<CallRow[]>("/calls.php")) ?? []);
    } catch (err) {
      showToast(`Failed to load calls: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogCall(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/calls.php", {
        lead_name: form.lead_name,
        phone: form.phone,
        source_channel: form.source_channel,
        language_detected: form.language_detected,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        intent_score: form.intent_score,
        notes: form.notes || null,
      });
    } catch (err) {
      setSaving(false);
      showToast(`Failed to log call: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    showToast("Call logged.");
    setForm({
      lead_name: "",
      phone: "",
      source_channel: "Manual",
      language_detected: "Indian English",
      duration_seconds: "",
      intent_score: "medium",
      notes: "",
    });
    setShowForm(false);
    void load();
  }

  function dispatchWhatsApp(call: CallRow) {
    const digits = call.phone.replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const message = `Hi ${call.lead_name}, thanks for speaking with Aangi Associates. ${call.notes ?? "We'll follow up with next steps shortly."}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function warmHandoff(call: CallRow) {
    const message = `Warm handoff — ${call.lead_name} (${call.phone}), source: ${call.source_channel ?? "unknown"}, intent: ${call.intent_score ?? "unscored"}. ${call.notes ?? ""}`;
    window.open(`https://wa.me/${ADVISOR_PHONE}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  async function requeue(call: CallRow) {
    try {
      await api.put(`/calls.php?id=${call.id}`, { status: "logged" });
    } catch (err) {
      showToast(`Failed to re-queue: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    showToast("Call re-queued.");
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base text-text">
            <PhoneOutgoing className="h-5 w-5 text-gold" /> Live Call Logs & Recordings Desk
          </h2>
          <p className="text-xs text-text-soft">
            Fills automatically once a telephony/voice-AI provider's webhook receiver is deployed. Log a call manually
            below in the meantime.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> {showForm ? "Cancel" : "Log a Call"}
        </Button>
      </div>

      {showForm && (
        <Card className="max-w-2xl">
          <form onSubmit={(e) => void handleLogCall(e)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lead Name</Label>
              <Input
                required
                value={form.lead_name}
                onChange={(e) => setForm({ ...form, lead_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Number</Label>
              <Input
                type="tel"
                required
                pattern="[0-9+\-\s()]{7,15}"
                title="Enter a valid phone number (7-15 digits)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source Channel</Label>
              <Input
                value={form.source_channel}
                onChange={(e) => setForm({ ...form, source_channel: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Language Detected</Label>
              <Select
                value={form.language_detected}
                onChange={(e) => setForm({ ...form, language_detected: e.target.value })}
              >
                <option>Indian English</option>
                <option>Hindi</option>
                <option>Gujarati</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Call Duration (seconds)</Label>
              <Input
                type="number"
                value={form.duration_seconds}
                onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Intent Score</Label>
              <Select
                value={form.intent_score}
                onChange={(e) => setForm({ ...form, intent_score: e.target.value as NonNullable<IntentScore> })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Logging…" : "Log Call"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <TableSkeleton cols={6} />
      ) : calls.length === 0 ? (
        <EmptyState message="No calls yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Language</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Intent</th>
                <th className="px-4 py-2.5">Recording</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-text">{c.lead_name}</p>
                    <p className="text-xs text-text-soft">
                      {c.phone} · {formatDate(c.created_at)}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-text-soft">{c.source_channel ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.language_detected ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-soft">{c.duration_seconds ? `${c.duration_seconds}s` : "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.intent_score ? <Badge variant={INTENT_VARIANT[c.intent_score]}>{c.intent_score}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.recording_url ? (
                      <audio controls src={c.recording_url} className="h-8 w-40" />
                    ) : (
                      <span className="text-xs text-text-soft">No recording</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-1 text-xs">
                      <button onClick={() => warmHandoff(c)} className="text-left text-gold-text hover:underline">
                        Warm Handoff
                      </button>
                      <button onClick={() => dispatchWhatsApp(c)} className="text-left text-gold-text hover:underline">
                        Dispatch WhatsApp
                      </button>
                      <button onClick={() => void requeue(c)} className="text-left text-text-soft hover:underline">
                        Re-queue
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
