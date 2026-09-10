import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { BoardSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout } from "../../portals/PortalLayout";
import { downloadCsv } from "../../lib/csv";
import { formatDate } from "../../lib/format";
import { LEAD_PIPELINE, LEAD_STATUS_LABEL, type Lead, type LeadAssignee, type LeadStatus } from "./types";

interface NavItem {
  label: string;
  href: string;
}

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  new: "bg-line-strong",
  contacted: "bg-gold",
  qualified: "bg-navy",
  converted: "bg-success",
  dropped: "bg-crimson",
};

type ActionKind = "contact" | "qualify" | "drop" | "convert";
interface ActiveAction {
  leadId: string;
  kind: ActionKind;
}

export function LeadsDeskPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assignees, setAssignees] = useState<LeadAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<ActiveAction | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [showDropped, setShowDropped] = useState(false);

  const canAssign = profile?.role === "admin" || profile?.role === "staff";

  async function load() {
    setLoading(true);
    try {
      setLeads((await api.get<Lead[]>("/leads.php")) ?? []);
    } catch (err) {
      showToast(`Failed to load leads: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoading(false);

    if (canAssign) {
      try {
        setAssignees((await api.get<LeadAssignee[]>("/users.php")) ?? []);
      } catch {
        // non-fatal — the board still renders without the assignee picker
      }
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byStatus = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = { new: [], contacted: [], qualified: [], converted: [], dropped: [] };
    leads.forEach((l) => grouped[l.status].push(l));
    return grouped;
  }, [leads]);

  function openAction(leadId: string, kind: ActionKind) {
    setActive({ leadId, kind });
    setNoteDraft("");
  }

  function closeAction() {
    setActive(null);
    setNoteDraft("");
  }

  function appendNote(existing: string | null, line: string) {
    const stamped = `[${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}] ${line}`;
    return existing ? `${existing}\n${stamped}` : stamped;
  }

  async function assignLead(lead: Lead, assignedTo: string) {
    try {
      await api.put(`/leads.php?id=${lead.id}`, { assigned_to: assignedTo || null });
    } catch (err) {
      showToast(`Failed to assign lead: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    void load();
  }

  // Every transition below is triggered by a real action (a contact logged,
  // a qualification note, an actual client record created, a drop reason) —
  // never a free status dropdown. That's deliberate: it keeps "converted"
  // meaning a client record genuinely exists, not just a label someone set.
  async function confirmContact(lead: Lead) {
    setBusy(true);
    try {
      await api.put(`/leads.php?id=${lead.id}`, {
        status: "contacted",
        notes: appendNote(lead.notes, noteDraft.trim() || "First contact logged."),
      });
    } catch (err) {
      setBusy(false);
      showToast(`Failed to log contact: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setBusy(false);
    showToast(`${lead.full_name} moved to Contacted.`);
    closeAction();
    void load();
  }

  async function confirmQualify(lead: Lead) {
    setBusy(true);
    try {
      await api.put(`/leads.php?id=${lead.id}`, {
        status: "qualified",
        notes: appendNote(lead.notes, noteDraft.trim() || "Qualified."),
      });
    } catch (err) {
      setBusy(false);
      showToast(`Failed to qualify lead: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setBusy(false);
    showToast(`${lead.full_name} moved to Qualified.`);
    closeAction();
    void load();
  }

  async function confirmDrop(lead: Lead) {
    setBusy(true);
    try {
      await api.put(`/leads.php?id=${lead.id}`, {
        status: "dropped",
        notes: appendNote(lead.notes, `Dropped: ${noteDraft.trim() || "no reason given"}`),
      });
    } catch (err) {
      setBusy(false);
      showToast(`Failed to drop lead: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setBusy(false);
    showToast(`${lead.full_name} dropped.`);
    closeAction();
    void load();
  }

  async function confirmConvert(lead: Lead) {
    setBusy(true);
    let client: { id: string };
    try {
      client = await api.post<{ id: string }>("/clients.php", {
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        owner_id: lead.assigned_to,
      });
    } catch (err) {
      setBusy(false);
      showToast(`Failed to create client: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }

    try {
      await api.put(`/leads.php?id=${lead.id}`, {
        status: "converted",
        converted_client_id: client.id,
        notes: appendNote(lead.notes, noteDraft.trim() || "Converted to client."),
      });
    } catch (err) {
      setBusy(false);
      showToast(
        `Client created, but failed to update lead: ${err instanceof ApiError ? err.message : "unknown error"}`,
        "error",
      );
      void load();
      return;
    }
    setBusy(false);
    showToast(`${lead.full_name} converted — client record created.`);
    closeAction();
    void load();
  }

  const visiblePipeline = showDropped ? [...LEAD_PIPELINE, "dropped" as LeadStatus] : LEAD_PIPELINE;

  return (
    <PortalLayout title="Leads Desk" navItems={navItems}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-soft">
          Cards move themselves — advance a lead by logging the action that actually happened (a call, a qualification,
          a real client record), not by dragging a card. New leads are captured via{" "}
          {profile?.role === "admin" ? (
            <Link to="/admin/settings" className="text-gold-text hover:underline">
              Settings → Lead Ingestion Hub
            </Link>
          ) : (
            "the Lead Ingestion Hub"
          )}
          .
        </p>
        <div className="flex shrink-0 gap-2">
          {leads.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "leads.csv",
                  ["Name", "Phone", "Email", "City", "Type", "Source", "Status", "Assigned To", "Created"],
                  leads.map((l) => [
                    l.full_name,
                    l.phone,
                    l.email,
                    l.city,
                    l.lead_type,
                    l.source,
                    l.status,
                    l.assignee?.full_name,
                    formatDate(l.created_at),
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowDropped((v) => !v)}>
            {showDropped ? "Hide dropped" : `Show dropped (${byStatus.dropped.length})`}
          </Button>
        </div>
      </div>

      {loading ? (
        <BoardSkeleton columns={4} />
      ) : leads.length === 0 ? (
        <EmptyState message="No leads yet." />
      ) : (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${showDropped ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          {visiblePipeline.map((status) => (
            <div key={status}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${COLUMN_ACCENT[status]}`} aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                  {LEAD_STATUS_LABEL[status]}
                </p>
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[0.7rem] text-text-soft">
                  {byStatus[status].length}
                </span>
              </div>

              <div className="space-y-3">
                {byStatus[status].length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-text-soft">
                    Empty
                  </p>
                )}

                {byStatus[status].map((lead) => (
                  <Card key={lead.id} className={`space-y-2.5 p-3.5 ${status === "dropped" ? "opacity-60" : ""}`}>
                    <div>
                      <p className="text-sm font-semibold text-text">{lead.full_name}</p>
                      <p className="text-xs text-text-soft">
                        {lead.phone}
                        {lead.city ? ` · ${lead.city}` : ""}
                        {lead.lead_type ? ` · ${lead.lead_type}` : ""}
                      </p>
                    </div>

                    <p className="font-mono text-[0.68rem] text-text-soft">
                      {lead.source} · {formatDate(lead.created_at)}
                    </p>

                    {canAssign ? (
                      <Select
                        value={lead.assigned_to ?? ""}
                        onChange={(e) => void assignLead(lead, e.target.value)}
                        className="h-8 text-xs"
                        aria-label={`Assign ${lead.full_name}`}
                      >
                        <option value="">Unassigned</option>
                        {assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name ?? a.id} ({a.role})
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <p className="text-xs text-text-soft">{lead.assignee?.full_name ?? "Unassigned"}</p>
                    )}

                    {status === "converted" && (
                      <p className="text-xs font-medium text-success">
                        ✓ Client record created
                        {lead.converted_client_id && (
                          <>
                            {" · "}
                            <Link to={`${basePath}/clients/${lead.converted_client_id}`} className="underline">
                              View client →
                            </Link>
                          </>
                        )}
                      </p>
                    )}

                    {status === "dropped" && lead.notes && (
                      <p className="whitespace-pre-line text-xs text-text-soft">
                        {lead.notes.split("\n").slice(-1)[0]}
                      </p>
                    )}

                    {active?.leadId === lead.id ? (
                      <div className="space-y-2 rounded-md border border-line-strong bg-surface-2 p-2.5">
                        <label className="block text-[0.7rem] font-medium text-text-soft" htmlFor={`note-${lead.id}`}>
                          {active.kind === "contact" && "What happened on this contact?"}
                          {active.kind === "qualify" && "Why is this lead qualified?"}
                          {active.kind === "drop" && "Reason for dropping (optional)"}
                          {active.kind === "convert" && "Anything to note before creating the client record?"}
                        </label>
                        <Input
                          id={`note-${lead.id}`}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={closeAction} disabled={busy}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant={active.kind === "drop" ? "secondary" : "primary"}
                            disabled={busy}
                            onClick={() => {
                              if (active.kind === "contact") void confirmContact(lead);
                              if (active.kind === "qualify") void confirmQualify(lead);
                              if (active.kind === "drop") void confirmDrop(lead);
                              if (active.kind === "convert") void confirmConvert(lead);
                            }}
                          >
                            {busy ? "Saving…" : "Confirm"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      status !== "converted" &&
                      status !== "dropped" && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {status === "new" && (
                            <Button size="sm" onClick={() => openAction(lead.id, "contact")}>
                              Log First Contact
                            </Button>
                          )}
                          {status === "contacted" && (
                            <Button size="sm" onClick={() => openAction(lead.id, "qualify")}>
                              Mark Qualified
                            </Button>
                          )}
                          {status === "qualified" && (
                            <Button size="sm" onClick={() => openAction(lead.id, "convert")}>
                              Convert to Client
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openAction(lead.id, "drop")}>
                            Drop
                          </Button>
                        </div>
                      )
                    )}
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
