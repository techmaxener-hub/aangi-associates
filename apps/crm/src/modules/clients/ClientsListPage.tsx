import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus,
  Download,
  Users,
  FolderArchive,
  Upload,
  Pencil,
  Trash2,
  MessageCircle,
  Mail,
  ListPlus,
} from "lucide-react";
import { api, API_BASE, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { downloadCsv } from "../../lib/csv";
import { formatDate, formatINR } from "../../lib/format";
import {
  PRODUCT_TYPES,
  POLICY_TABS,
  PRODUCT_TYPE_TO_POLICY_TAB,
  type Client,
  type PolicyListRow,
  type PolicyExtractResult,
} from "./types";

const EMPTY_POLICY_FORM = {
  client_id: "",
  policy_number: "",
  insurer: "TATA AIA",
  product_type: PRODUCT_TYPES[0],
  sum_assured: "",
  premium: "",
  start_date: "",
  renewal_date: "",
};

export function ClientsListPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<PolicyListRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"All" | (typeof POLICY_TABS)[number]>("All");
  const [search, setSearch] = useState("");

  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    household_name: "",
    date_of_birth: "",
  });
  const [savingClient, setSavingClient] = useState(false);

  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY_FORM);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_POLICY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  const canCreate = profile?.role === "admin" || profile?.role === "staff";
  const canEdit = canCreate;
  const canDelete = profile?.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const [policyRows, clientRows] = await Promise.all([
        api.get<PolicyListRow[]>("/client_policies.php?list=1"),
        api.get<Client[]>("/clients.php?picker=1"),
      ]);
      setRows(policyRows ?? []);
      setClients(clientRows ?? []);
    } catch (err) {
      showToast(`Failed to load policies: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = rows.filter((r) => {
    if (tab !== "All" && (PRODUCT_TYPE_TO_POLICY_TAB[r.product_type] ?? "General Insurance") !== tab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.client_name.toLowerCase().includes(q) ||
      (r.policy_number ?? "").toLowerCase().includes(q) ||
      r.insurer.toLowerCase().includes(q) ||
      r.product_type.toLowerCase().includes(q)
    );
  });

  async function handleAddClient(event: FormEvent) {
    event.preventDefault();
    setSavingClient(true);
    try {
      const created = await api.post<{ id: string }>("/clients.php", {
        full_name: clientForm.full_name,
        phone: clientForm.phone,
        email: clientForm.email || null,
        city: clientForm.city || null,
        household_name: clientForm.household_name || null,
        date_of_birth: clientForm.date_of_birth || null,
        owner_id: profile?.role === "associate" ? profile.id : null,
      });
      showToast("Client added.");
      setClientForm({ full_name: "", phone: "", email: "", city: "", household_name: "", date_of_birth: "" });
      setShowClientForm(false);
      const freshClients = await api.get<Client[]>("/clients.php?picker=1");
      setClients(freshClients ?? []);
      setPolicyForm((f) => ({ ...f, client_id: created.id }));
    } catch (err) {
      showToast(`Failed to add client: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setSavingClient(false);
  }

  async function handlePdfUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!policyForm.client_id) {
      showToast("Choose a client first, then upload the policy PDF.", "error");
      return;
    }
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("client_id", policyForm.client_id);
      formData.append("file", file);
      const result = await api.postForm<PolicyExtractResult>("/policy_extract.php", formData);
      setPolicyForm((f) => ({
        ...f,
        policy_number: result.fields.policy_number ?? f.policy_number,
        insurer: result.fields.insurer ?? f.insurer,
        product_type:
          result.fields.product_type && PRODUCT_TYPES.includes(result.fields.product_type)
            ? result.fields.product_type
            : f.product_type,
        sum_assured: result.fields.sum_assured != null ? String(result.fields.sum_assured) : f.sum_assured,
        premium: result.fields.premium != null ? String(result.fields.premium) : f.premium,
        start_date: result.fields.start_date ?? f.start_date,
        renewal_date: result.fields.renewal_date ?? f.renewal_date,
      }));
      setPendingPdf(file);
      if (result.low_confidence || result.fields_found === 0) {
        showToast("Couldn't read this PDF automatically — please check and fill in the details by hand.", "error");
      } else {
        showToast(`Read ${result.fields_found} field(s) from the PDF — please review before saving.`);
      }
    } catch (err) {
      showToast(`Failed to read PDF: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setExtracting(false);
  }

  async function handleAddPolicy(event: FormEvent) {
    event.preventDefault();
    if (!policyForm.client_id) {
      showToast("Choose a client first.", "error");
      return;
    }
    setSavingPolicy(true);
    try {
      await api.post("/client_policies.php", {
        client_id: policyForm.client_id,
        policy_number: policyForm.policy_number || null,
        insurer: policyForm.insurer,
        product_type: policyForm.product_type,
        sum_assured: policyForm.sum_assured ? Number(policyForm.sum_assured) : null,
        premium: policyForm.premium ? Number(policyForm.premium) : null,
        start_date: policyForm.start_date || null,
        renewal_date: policyForm.renewal_date || null,
      });
      if (pendingPdf) {
        const docForm = new FormData();
        docForm.append("client_id", policyForm.client_id);
        docForm.append("file", pendingPdf);
        await api.postForm("/documents.php", docForm).catch(() => {
          showToast("Policy saved, but attaching the PDF to Documents failed — upload it there by hand.", "error");
        });
      }
    } catch (err) {
      setSavingPolicy(false);
      showToast(`Failed to add policy: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSavingPolicy(false);
    showToast("Policy added.");
    setPolicyForm(EMPTY_POLICY_FORM);
    setPendingPdf(null);
    setShowPolicyForm(false);
    void load();
  }

  function startEdit(row: PolicyListRow) {
    setEditingId(row.id);
    setEditForm({
      client_id: row.client_id,
      policy_number: row.policy_number ?? "",
      insurer: row.insurer,
      product_type: row.product_type,
      sum_assured: row.sum_assured != null ? String(row.sum_assured) : "",
      premium: row.premium != null ? String(row.premium) : "",
      start_date: row.start_date ?? "",
      renewal_date: row.renewal_date ?? "",
    });
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await api.put(`/client_policies.php?id=${editingId}`, {
        policy_number: editForm.policy_number || null,
        insurer: editForm.insurer,
        product_type: editForm.product_type,
        sum_assured: editForm.sum_assured ? Number(editForm.sum_assured) : null,
        premium: editForm.premium ? Number(editForm.premium) : null,
        start_date: editForm.start_date || null,
        renewal_date: editForm.renewal_date || null,
      });
      showToast("Policy updated.");
      setEditingId(null);
      void load();
    } catch (err) {
      showToast(`Failed to update: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setSavingEdit(false);
  }

  async function handleDelete(row: PolicyListRow) {
    if (!window.confirm(`Delete the ${row.product_type} policy for ${row.client_name}? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      await api.del(`/client_policies.php?id=${row.id}`);
      showToast("Policy deleted.");
      void load();
    } catch (err) {
      showToast(`Failed to delete: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setDeletingId(null);
  }

  async function handleSendEmail(row: PolicyListRow) {
    setEmailingId(row.id);
    try {
      await api.post(`/policy_summary.php?policy_id=${row.id}&action=email`, {});
      showToast(`Policy summary emailed to ${row.client_email ?? "the client"}.`);
    } catch (err) {
      showToast(`Failed to send email: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setEmailingId(null);
  }

  function exportCsv() {
    downloadCsv(
      "policies.csv",
      ["Product Name", "Insurer", "Policy Holder", "Policy Number", "Sum Assured", "Premium", "Start", "End", "Advisor"],
      filtered.map((r) => [
        r.product_type,
        r.insurer,
        r.client_name,
        r.policy_number,
        r.sum_assured,
        r.premium,
        formatDate(r.start_date),
        formatDate(r.renewal_date),
        r.advisor_name,
      ]),
    );
  }

  return (
    <PortalLayout title="My Clients" navItems={navItems}>
      <div className="mb-4 flex flex-wrap gap-2">
        {canCreate && (
          <>
            <Button
              onClick={() => {
                setShowPolicyForm((v) => !v);
                setShowClientForm(false);
              }}
            >
              <ListPlus className="h-4 w-4" /> {showPolicyForm ? "Cancel" : "+ Add Policy"}
            </Button>
            <Button asChild variant="ghost">
              <Link to={`${basePath}/clients/bulk-add`}>
                <ListPlus className="h-4 w-4" /> + Add Bulk Policies
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowPolicyForm(true);
                setShowClientForm(false);
                setTimeout(() => document.getElementById("policy-pdf-upload")?.click(), 50);
              }}
            >
              <Upload className="h-4 w-4" /> + Add Policy PDF
            </Button>
            <Button asChild variant="ghost">
              <Link to={`${basePath}/clients/bulk-import`}>
                <FolderArchive className="h-4 w-4" /> + Add Bulk Policies PDF
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowClientForm((v) => !v);
                setShowPolicyForm(false);
              }}
            >
              <UserPlus className="h-4 w-4" /> {showClientForm ? "Cancel" : "New Client"}
            </Button>
          </>
        )}
        {rows.length > 0 && (
          <Button variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {showClientForm && (
        <Card className="mb-4 max-w-xl">
          <form onSubmit={(e) => void handleAddClient(e)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-name">Full Name</Label>
              <Input id="c-name" required value={clientForm.full_name} onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" required value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" value={clientForm.city} onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={savingClient}>
                {savingClient ? "Saving…" : "Save Client"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {showPolicyForm && (
        <Card className="mb-4 max-w-3xl">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Client</Label>
              <Select value={policyForm.client_id} onChange={(e) => setPolicyForm({ ...policyForm, client_id: e.target.value })}>
                <option value="">— Choose a client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <Button asChild variant="ghost" size="sm" disabled={extracting}>
              <label htmlFor="policy-pdf-upload" className="cursor-pointer">
                <Upload className="h-3.5 w-3.5" /> {extracting ? "Reading PDF…" : "Upload Policy PDF"}
              </label>
            </Button>
            <input id="policy-pdf-upload" type="file" accept="application/pdf" className="hidden" disabled={extracting} onChange={(e) => void handlePdfUpload(e)} />
          </div>
          {pendingPdf && (
            <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-text-soft">
              Pre-filled from <span className="font-medium text-text">{pendingPdf.name}</span> — check every field below before saving.
            </p>
          )}
          <form onSubmit={(e) => void handleAddPolicy(e)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Policy Number</Label>
              <Input value={policyForm.policy_number} onChange={(e) => setPolicyForm({ ...policyForm, policy_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Insurer</Label>
              <Input value={policyForm.insurer} onChange={(e) => setPolicyForm({ ...policyForm, insurer: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Product Type</Label>
              <Select value={policyForm.product_type} onChange={(e) => setPolicyForm({ ...policyForm, product_type: e.target.value })}>
                {PRODUCT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sum Assured (₹)</Label>
              <Input type="number" value={policyForm.sum_assured} onChange={(e) => setPolicyForm({ ...policyForm, sum_assured: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Premium (₹)</Label>
              <Input type="number" value={policyForm.premium} onChange={(e) => setPolicyForm({ ...policyForm, premium: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={policyForm.start_date} onChange={(e) => setPolicyForm({ ...policyForm, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Renewal / End Date</Label>
              <Input type="date" value={policyForm.renewal_date} onChange={(e) => setPolicyForm({ ...policyForm, renewal_date: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={savingPolicy}>
                {savingPolicy ? "Saving…" : "Save Policy"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-2">
        {(["All", ...POLICY_TABS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t ? "bg-navy text-on-navy" : "bg-surface-2 text-text-soft hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by client, policy number, insurer…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <TableSkeleton cols={10} />
      ) : filtered.length === 0 ? (
        <EmptyState message="No policies in this view." icon={Users} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-3 py-2.5">Product Name</th>
                <th className="px-3 py-2.5">Insurance Company</th>
                <th className="px-3 py-2.5">Policy Holder</th>
                <th className="px-3 py-2.5">Policy Number</th>
                <th className="px-3 py-2.5">Policy Type</th>
                <th className="px-3 py-2.5 text-right">Sum Assured</th>
                <th className="px-3 py-2.5 text-right">Premium</th>
                <th className="px-3 py-2.5">Start Date</th>
                <th className="px-3 py-2.5">End Date</th>
                <th className="px-3 py-2.5">Advisor</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isEditing = editingId === r.id;
                const digits = r.client_phone.replace(/\D/g, "");
                const waPhone = digits.length === 10 ? `91${digits}` : digits;
                const waMessage = `Hi ${r.client_name}, here is your ${r.product_type} policy summary from Aangi Associates. We'll send the full PDF shortly.`;
                return (
                  <tr key={r.id} className="border-t border-line odd:bg-surface-2/40 align-top">
                    {isEditing ? (
                      <td colSpan={11} className="px-3 py-3">
                        <form onSubmit={(e) => void handleSaveEdit(e)} className="grid grid-cols-4 gap-3">
                          <Input placeholder="Policy Number" value={editForm.policy_number} onChange={(e) => setEditForm({ ...editForm, policy_number: e.target.value })} />
                          <Input placeholder="Insurer" value={editForm.insurer} onChange={(e) => setEditForm({ ...editForm, insurer: e.target.value })} />
                          <Select value={editForm.product_type} onChange={(e) => setEditForm({ ...editForm, product_type: e.target.value })}>
                            {PRODUCT_TYPES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </Select>
                          <Input type="number" placeholder="Sum Assured" value={editForm.sum_assured} onChange={(e) => setEditForm({ ...editForm, sum_assured: e.target.value })} />
                          <Input type="number" placeholder="Premium" value={editForm.premium} onChange={(e) => setEditForm({ ...editForm, premium: e.target.value })} />
                          <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                          <Input type="date" value={editForm.renewal_date} onChange={(e) => setEditForm({ ...editForm, renewal_date: e.target.value })} />
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={savingEdit}>
                              {savingEdit ? "Saving…" : "Save"}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 text-text">{r.product_type}</td>
                        <td className="px-3 py-2.5 text-text-soft">{r.insurer}</td>
                        <td className="px-3 py-2.5">
                          <Link to={`${basePath}/clients/${r.client_id}`} className="font-medium text-gold-text hover:underline">
                            {r.client_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-text-soft">{r.policy_number ?? "—"}</td>
                        <td className="px-3 py-2.5 text-text-soft">{PRODUCT_TYPE_TO_POLICY_TAB[r.product_type] ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-soft">{formatINR(r.sum_assured)}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-soft">{formatINR(r.premium)}</td>
                        <td className="px-3 py-2.5 text-text-soft">{formatDate(r.start_date)}</td>
                        <td className="px-3 py-2.5 text-text-soft">{formatDate(r.renewal_date)}</td>
                        <td className="px-3 py-2.5 text-text-soft">{r.advisor_name ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-2.5 whitespace-nowrap">
                            <a
                              title="Send via WhatsApp"
                              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`}
                              target="_blank"
                              rel="noopener"
                              className="text-emerald-600 hover:opacity-70"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                            <button
                              title="Send via Email"
                              disabled={emailingId === r.id}
                              onClick={() => void handleSendEmail(r)}
                              className="text-blue-600 hover:opacity-70 disabled:opacity-40"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                            <a title="Download Policy" href={`${API_BASE}/policy_summary.php?policy_id=${r.id}`} className="text-gold-text hover:opacity-70">
                              <Download className="h-4 w-4" />
                            </a>
                            {canEdit && (
                              <button title="Edit" onClick={() => startEdit(r)} className="text-text-soft hover:text-navy">
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                title="Delete"
                                disabled={deletingId === r.id}
                                onClick={() => void handleDelete(r)}
                                className="text-crimson hover:opacity-70 disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
