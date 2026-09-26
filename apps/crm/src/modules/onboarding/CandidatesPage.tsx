import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { PortalLayout } from "../../portals/PortalLayout";
import { adminNavItems } from "../../portals/admin/nav";
import { ListSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { formatDate } from "../../lib/format";
import { stagesFor, stageLabel, type Candidate, type CandidateTrack } from "./types";

export function CandidatesPage() {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trackFilter, setTrackFilter] = useState<"all" | CandidateTrack>("all");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    occupation: "",
    track: "associate" as CandidateTrack,
  });

  async function load() {
    setLoading(true);
    try {
      setCandidates((await api.get<Candidate[]>("/candidates.php")) ?? []);
    } catch (err) {
      showToast(`Failed to load candidates: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
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
      await api.post("/candidates.php", {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        city: form.city || null,
        occupation: form.occupation || null,
        track: form.track,
        stage: stagesFor(form.track)[0],
      });
    } catch (err) {
      setSaving(false);
      showToast(`Failed to add candidate: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    showToast("Candidate added.");
    setForm({ full_name: "", phone: "", email: "", city: "", occupation: "", track: "associate" });
    setShowForm(false);
    void load();
  }

  async function advanceStage(candidate: Candidate, stage: string) {
    try {
      await api.put(`/candidates.php?id=${candidate.id}`, { stage });
    } catch (err) {
      showToast(`Failed to update stage: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    void load();
  }

  const visible = candidates.filter((c) => trackFilter === "all" || c.track === trackFilter);

  return (
    <PortalLayout title="Associate & Staff Onboarding" navItems={adminNavItems}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "associate", "staff"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTrackFilter(f)}
              className={`rounded-full border px-4 py-1.5 text-xs font-mono capitalize ${
                trackFilter === f ? "border-navy bg-navy text-on-navy" : "border-line-strong bg-surface text-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add Candidate"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 max-w-xl">
          <form onSubmit={(e) => void handleAdd(e)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>Full Name</Label>
              <Input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>Phone</Label>
              <Input
                type="tel"
                required
                pattern="[0-9+\-\s()]{7,15}"
                title="Enter a valid phone number (7-15 digits)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>Current Occupation</Label>
              <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>Track</Label>
              <Select
                value={form.track}
                onChange={(e) => setForm({ ...form, track: e.target.value as CandidateTrack })}
              >
                <option value="associate">Associate (Field Advisor)</option>
                <option value="staff">Staff (Back-Office)</option>
              </Select>
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Candidate"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState message="No candidates yet." icon={UserPlus} />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-text">
                    <Link to={`/admin/team/${c.id}`} className="hover:underline">
                      {c.full_name}
                    </Link>{" "}
                    <span className="text-xs font-normal capitalize text-text-soft">· {c.track}</span>
                  </p>
                  <p className="text-xs text-text-soft">
                    {c.phone} · {c.city ?? "—"} · Applied {formatDate(c.created_at)}
                  </p>
                </div>
                <Select value={c.stage} onChange={(e) => void advanceStage(c, e.target.value)} className="w-56">
                  {stagesFor(c.track).map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {stageLabel(s)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-1">
                {stagesFor(c.track).map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded ${
                      stagesFor(c.track).indexOf(c.stage) >= i ? "bg-crimson" : "bg-surface-2"
                    }`}
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
