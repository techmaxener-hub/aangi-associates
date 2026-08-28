import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { PortalLayout } from "../../portals/PortalLayout";
import { adminNavItems } from "../../portals/admin/nav";
import { formatDate } from "../../lib/format";
import { stagesFor, stageLabel, type Candidate } from "./types";
import type { Task } from "../tasks/types";

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [c, t] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", id).single(),
      supabase
        .from("tasks")
        .select("*, assignee:profiles!assigned_to(id, full_name, role)")
        .eq("linked_candidate_id", id)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (c.error) showToast(`Failed to load candidate: ${c.error.message}`, "error");
    setCandidate(c.data ?? null);
    setNotes(c.data?.notes ?? "");
    setTasks((t.data as unknown as Task[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function advanceStage(stage: string) {
    if (!candidate) return;
    const { error } = await supabase.from("candidates").update({ stage }).eq("id", candidate.id);
    if (error) {
      showToast(`Failed to update stage: ${error.message}`, "error");
      return;
    }
    void load();
  }

  async function saveNotes() {
    if (!candidate) return;
    setSaving(true);
    const { error } = await supabase.from("candidates").update({ notes }).eq("id", candidate.id);
    setSaving(false);
    if (error) {
      showToast(`Failed to save notes: ${error.message}`, "error");
      return;
    }
    showToast("Notes saved.");
  }

  if (loading) {
    return (
      <PortalLayout title="Candidate" navItems={adminNavItems}>
        <p className="text-text-soft">Loading…</p>
      </PortalLayout>
    );
  }

  if (!candidate) {
    return (
      <PortalLayout
        title="Candidate not found"
        navItems={adminNavItems}
        breadcrumbs={[{ label: "Onboarding", href: "/admin/team" }, { label: "Not found" }]}
      >
        <Link to="/admin/team" className="text-gold-text hover:underline">
          ← Back to onboarding
        </Link>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      title={candidate.full_name}
      navItems={adminNavItems}
      breadcrumbs={[{ label: "Onboarding", href: "/admin/team" }, { label: candidate.full_name }]}
    >
      <div className="mb-6 grid grid-cols-4 gap-4 text-sm">
        <InfoItem label="Track" value={candidate.track} />
        <InfoItem label="Phone" value={candidate.phone} />
        <InfoItem label="City" value={candidate.city ?? "—"} />
        <InfoItem label="Occupation" value={candidate.occupation ?? "—"} />
      </div>

      <Card className="mb-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium text-text">Onboarding stage</p>
          <Select value={candidate.stage} onChange={(e) => void advanceStage(e.target.value)} className="w-56">
            {stagesFor(candidate.track).map((s) => (
              <option key={s} value={s} className="capitalize">
                {stageLabel(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-1">
          {stagesFor(candidate.track).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded ${stagesFor(candidate.track).indexOf(candidate.stage) >= i ? "bg-crimson" : "bg-surface-2"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-text-soft">
          Applied {formatDate(candidate.created_at)} · Source: {candidate.source}
        </p>
      </Card>

      <Card className="mb-6 max-w-xl p-4">
        <p className="mb-2 font-medium text-text">Notes</p>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => void saveNotes()} disabled={saving}>
            {saving ? "Saving…" : "Save Notes"}
          </Button>
        </div>
      </Card>

      <div>
        <p className="mb-2 font-medium text-text">Linked tasks</p>
        {tasks.length === 0 ? (
          <p className="text-sm text-text-soft">No tasks linked to this candidate yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <Card key={t.id} className="p-3 text-sm">
                <p className="font-medium text-text">{t.title}</p>
                <p className="text-xs text-text-soft">
                  {t.assignee?.full_name ?? "Unassigned"} ·{" "}
                  <span className="capitalize">{t.status.replace("_", " ")}</span>
                  {t.due_date ? ` · Due ${formatDate(t.due_date)}` : ""}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-soft">{label}</p>
      <p className="capitalize text-text">{value}</p>
    </div>
  );
}
