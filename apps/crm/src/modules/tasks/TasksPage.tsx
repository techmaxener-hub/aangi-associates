import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { PortalLayout } from "../../portals/PortalLayout";
import { formatDate } from "../../lib/format";
import { TASK_STATUSES, type Task, type TaskAssignee, type TaskStatus } from "./types";

interface NavItem {
  label: string;
  href: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };

export function TasksPage({ navItems }: { navItems: NavItem[] }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", due_date: "" });

  const canAssign = profile?.role === "admin" || profile?.role === "staff";

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*, assignee:profiles!assigned_to(id, full_name, role)")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) showToast(`Failed to load tasks: ${error.message}`, "error");
    setTasks((data as unknown as Task[]) ?? []);
    setLoading(false);

    if (canAssign) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, role").in("role", ["admin", "staff", "associate"]);
      setAssignees(profs ?? []);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      created_by: profile?.id ?? null,
    });
    setSaving(false);
    if (error) {
      showToast(`Failed to create task: ${error.message}`, "error");
      return;
    }
    showToast("Task created.");
    setForm({ title: "", description: "", assigned_to: "", due_date: "" });
    setShowForm(false);
    void load();
  }

  async function updateStatus(task: Task, status: TaskStatus) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) {
      showToast(`Failed to update task: ${error.message}`, "error");
      return;
    }
    void load();
  }

  return (
    <PortalLayout title="Tasks" navItems={navItems}>
      {canAssign && (
        <div className="mb-4">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New Task"}
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="mb-6 max-w-xl">
          <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Title</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name ?? a.id} ({a.role})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Task"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-text-soft">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-text-soft">No tasks yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {TASK_STATUSES.map((status) => (
            <div key={status}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">{STATUS_LABEL[status]}</p>
              <div className="space-y-2">
                {tasks
                  .filter((t) => t.status === status)
                  .map((t) => (
                    <Card key={t.id} className="p-3">
                      <p className="text-sm font-medium text-text">{t.title}</p>
                      {t.description && <p className="mt-1 text-xs text-text-soft">{t.description}</p>}
                      <p className="mt-1 text-xs text-text-soft">
                        {t.assignee?.full_name ?? "Unassigned"} {t.due_date ? `· Due ${formatDate(t.due_date)}` : ""}
                      </p>
                      <Select
                        value={t.status}
                        onChange={(e) => void updateStatus(t, e.target.value as TaskStatus)}
                        className="mt-2 h-8 text-xs"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
