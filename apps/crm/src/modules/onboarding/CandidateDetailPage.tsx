import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { PortalLayout } from "../../portals/PortalLayout";
import { adminNavItems } from "../../portals/admin/nav";
import { DetailSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
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
    try {
      const [c, t] = await Promise.all([
        api.get<Candidate>(`/candidates.php?id=${id}`),
        api.get<Task[]>(`/tasks.php?linked_candidate_id=${id}`),
      ]);
      setCandidate(c ?? null);
      setNotes(c?.notes ?? "");
      setTasks(t ?? []);
    } catch (err) {
      showToast(`Failed to load candidate: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      setCandidate(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function advanceStage(stage: string) {
    if (!candidate) return;
    try {
      await api.put(`/candidates.php?id=${candidate.id}`, { stage });
    } catch (err) {
      showToast(`Failed to update stage: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    void load();
  }

  async function saveNotes() {
    if (!candidate) return;
    setSaving(true);
    try {
      await api.put(`/candidates.php?id=${candidate.id}`, { notes });
    } catch (err) {
      setSaving(false);
      showToast(`Failed to save notes: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    showToast("Notes saved.");
  }

  if (loading) {
    return (
      <PortalLayout title="Candidate" navItems={adminNavItems}>
        <DetailSkeleton />
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
      <div className="mb-6 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
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
          <EmptyState message="No tasks linked to this candidate yet." icon={ListChecks} />
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
