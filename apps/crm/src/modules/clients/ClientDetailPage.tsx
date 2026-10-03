import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Printer,
  Phone,
  MessageCircle,
  Users,
  Upload,
  FileText,
  Download,
  Trash2,
  ShieldCheck,
  TrendingUp,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { api, API_BASE, ApiError } from "../../lib/api";
import { useAuth } from "../../auth/useAuth";
import { exportPolicySummaryPdf } from "./exportPolicySummaryPdf";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { DetailSkeleton } from "../../components/ui/skeleton";
import { EmptyState } from "../../components/ui/empty-state";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { formatINR, formatDate, daysUntil } from "../../lib/format";
import {
  OPPORTUNITY_STAGES,
  CLAIM_STAGES,
  PRODUCT_TYPES,
  POLICY_STATUS_VARIANT,
  type Client,
  type ClientPolicy,
  type Opportunity,
  type Claim,
  type Communication,
  type ClientDocument,
  type PolicyExtractResult,
} from "./types";
import type { ProductCategory } from "../business-planning/types";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_MAP: Record<string, string> = {
  "Pure Term Plan": "Life & Risk Protection",
  "Critical Illness Cover": "Life & Risk Protection",
  "Family Mediclaim": "Life & Risk Protection",
  "Child Education Plan": "Wealth & Guaranteed Solutions",
  "Guaranteed Return Plan": "Wealth & Guaranteed Solutions",
  "Mutual Fund": "Wealth & Guaranteed Solutions",
  "Pension/Annuity": "Retirement & Estate Design",
  "Keyman Insurance": "Business & Corporate Risk",
  "Group Health Cover": "Business & Corporate Risk",
  "General Insurance": "General Insurance",
};
const ALL_CATEGORIES = [
  "Life & Risk Protection",
  "Wealth & Guaranteed Solutions",
  "Retirement & Estate Design",
  "Business & Corporate Risk",
  "General Insurance",
];
// One representative product to lead with per category — the suggestion
// just needs a concrete starting point for the conversation, not an
// exhaustive list; the advisor picks the actual product once the client
// engages.
const CATEGORY_LEAD_PRODUCT: Record<string, string> = {
  "Life & Risk Protection": "Pure Term Plan",
  "Wealth & Guaranteed Solutions": "Guaranteed Return Plan",
  "Retirement & Estate Design": "Pension/Annuity",
  "Business & Corporate Risk": "Keyman Insurance",
  "General Insurance": "General Insurance",
};

interface Suggestion {
  id: string;
  title: string;
  reason: string;
  waMessage?: string;
}

// A pure function over what's already loaded for this client — no extra
// API calls, no persistence. Every suggestion here is advisory only: the
// advisor decides whether and how to act on it, same posture as the
// existing single-line "Cross-sell signal" banner this replaces, just with
// more than one kind of signal and a concrete next step per signal.
function buildSuggestions(client: Client, policies: ClientPolicy[], claims: Claim[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const activePolicies = policies.filter((p) => p.status === "active");
  const coveredCategories = new Set(activePolicies.map((p) => CATEGORY_MAP[p.product_type]).filter(Boolean));
  const gapCategories = ALL_CATEGORIES.filter((cat) => !coveredCategories.has(cat));

  for (const cat of gapCategories) {
    const leadProduct = CATEGORY_LEAD_PRODUCT[cat];
    suggestions.push({
      id: `gap-${cat}`,
      title: `No active cover in ${cat}`,
      reason: `${client.full_name} has no active policy in this category — a ${leadProduct} is a natural opening.`,
      waMessage: `Hi ${client.full_name}, as part of your annual review with Aangi Associates, I noticed you don't currently have cover under ${cat}. A ${leadProduct} could be a good fit — happy to walk you through it whenever convenient.`,
    });
  }

  // A policy that LAPSED or MATURED, in a category with no active
  // replacement, is a stronger lead than a plain gap — the client was
  // already sold on the category once.
  for (const p of policies) {
    if (p.status === "active") continue;
    const cat = CATEGORY_MAP[p.product_type];
    if (!cat || coveredCategories.has(cat)) continue;
    suggestions.push({
      id: `lapsed-${p.id}`,
      title: `${p.product_type} ${p.status} — no active replacement`,
      reason: `This ${p.status} policy was the only cover ${client.full_name} had in ${cat}; there's currently nothing active in its place.`,
      waMessage: `Hi ${client.full_name}, I noticed your ${p.product_type} policy is now ${p.status} and you don't have an active replacement yet. Would you like to revisit this before any gap in cover becomes a problem?`,
    });
  }

  // Diversification within an already-covered category: Mutual Fund is its
  // own product line even when Wealth & Guaranteed Solutions is already
  // "covered" by something else (e.g. a Guaranteed Return Plan) — only
  // surfaced when that category ISN'T already a flat gap above, so this
  // never doubles up with the first signal.
  const hasMutualFund = activePolicies.some((p) => p.product_type === "Mutual Fund");
  if (!hasMutualFund && !gapCategories.includes("Wealth & Guaranteed Solutions")) {
    suggestions.push({
      id: "no-mutual-fund",
      title: "No active Mutual Fund / SIP",
      reason: `${client.full_name} has wealth cover but no Mutual Fund exposure — worth raising as a diversification option.`,
      waMessage: `Hi ${client.full_name}, alongside your existing cover, a Mutual Fund SIP could be a good way to diversify further. Want to discuss options?`,
    });
  }

  // A recently settled claim is a natural, low-pressure moment to revisit
  // overall coverage adequacy — informational, no WhatsApp CTA (the wording
  // right after a claim deserves the advisor's own judgment, not a
  // templated nudge).
  for (const c of claims) {
    if (c.stage !== "settled" || !c.settled_at) continue;
    const daysAgo = Math.floor((Date.now() - new Date(c.settled_at).getTime()) / (24 * 60 * 60 * 1000));
    if (daysAgo >= 0 && daysAgo <= 90) {
      suggestions.push({
        id: `claim-settled-${c.id}`,
        title: `Claim settled ${daysAgo === 0 ? "today" : `${daysAgo}d ago`}`,
        reason: `A claim for ${client.full_name} was settled recently — a good moment to review overall coverage adequacy while it's top of mind.`,
      });
    }
  }

  return suggestions;
}

type Tab = "overview" | "policies" | "pipeline" | "claims" | "communications" | "documents";

export function ClientDetailPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [policies, setPolicies] = useState<ClientPolicy[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    try {
      const [c, p, o, cl, co, dc] = await Promise.all([
        api.get<Client>(`/clients.php?id=${id}`),
        api.get<ClientPolicy[]>(`/client_policies.php?client_id=${id}`),
        api.get<Opportunity[]>(`/opportunities.php?client_id=${id}`),
        api.get<Claim[]>(`/claims.php?client_id=${id}`),
        api.get<Communication[]>(`/communications.php?client_id=${id}`),
        api.get<ClientDocument[]>(`/documents.php?client_id=${id}`),
      ]);
      setClient(c ?? null);
      setPolicies(p ?? []);
      setOpportunities(o ?? []);
      setClaims(cl ?? []);
      setComms(co ?? []);
      setDocs(dc ?? []);
    } catch (err) {
      showToast(`Failed to load client: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      setClient(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [loggingTouch, setLoggingTouch] = useState<string | null>(null);
  // One-tap touchpoint logging — the full Communications tab still asks
  // for a note, but most check-ins don't need one typed out on the spot;
  // this just records the channel + timestamp instantly, same table.
  async function logQuickTouch(channel: "call" | "whatsapp" | "other", label: string) {
    if (!client) return;
    setLoggingTouch(channel);
    try {
      await api.post("/communications.php", { client_id: client.id, channel, notes: label });
      showToast(`Logged: ${label}.`);
      void loadAll();
    } catch (err) {
      showToast(`Failed to log: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setLoggingTouch(null);
  }

  const suggestions = client ? buildSuggestions(client, policies, claims) : [];
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  if (loading) {
    return (
      <PortalLayout title="My Clients" navItems={navItems}>
        <DetailSkeleton />
      </PortalLayout>
    );
  }

  if (!client) {
    return (
      <PortalLayout
        title="Client not found"
        navItems={navItems}
        breadcrumbs={[{ label: "My Clients", href: `${basePath}/clients` }, { label: "Not found" }]}
      >
        <Link to={`${basePath}/clients`} className="text-gold-text hover:underline">
          ← Back to clients
        </Link>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      title={client.full_name}
      navItems={navItems}
      breadcrumbs={[{ label: "My Clients", href: `${basePath}/clients` }, { label: client.full_name }]}
    >
      <PrintableClientSummary client={client} policies={policies} />

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={loggingTouch !== null}
          onClick={() => void logQuickTouch("call", "Called")}
        >
          <Phone className="h-3.5 w-3.5" /> Called
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loggingTouch !== null}
          onClick={() => void logQuickTouch("whatsapp", "WhatsApp'd")}
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp'd
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loggingTouch !== null}
          onClick={() => void logQuickTouch("other", "Met")}
        >
          <Users className="h-3.5 w-3.5" /> Met
        </Button>
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print Summary
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm lg:grid-cols-5">
        <InfoItem label="Phone" value={client.phone} />
        <InfoItem label="Email" value={client.email ?? "—"} />
        <InfoItem label="City" value={client.city ?? "—"} />
        <InfoItem label="Household" value={client.household_name ?? "—"} />
        <InfoItem label="Date of Birth" value={client.date_of_birth ? formatDate(client.date_of_birth) : "—"} />
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-surface-2">
          <button
            type="button"
            onClick={() => setSuggestionsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5 font-semibold text-gold-text">
              <Lightbulb className="h-3.5 w-3.5" /> {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}
            </span>
            {suggestionsOpen ? <ChevronDown className="h-3.5 w-3.5 text-text-soft" /> : <ChevronRight className="h-3.5 w-3.5 text-text-soft" />}
          </button>
          {suggestionsOpen && (
            <div className="divide-y divide-line border-t border-gold/40">
              {suggestions.map((s) => {
                const digits = client.phone.replace(/\D/g, "");
                const waPhone = digits.length === 10 ? `91${digits}` : digits;
                return (
                  <div key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-xs text-text">
                    <span>
                      <span className="font-medium">{s.title}.</span> <span className="text-text-soft">{s.reason}</span>
                    </span>
                    {s.waMessage && (
                      <a
                        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(s.waMessage)}`}
                        target="_blank"
                        rel="noopener"
                        className="shrink-0 font-medium text-gold-text hover:underline"
                      >
                        WhatsApp →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 flex gap-2 border-b border-line">
        {(["overview", "policies", "pipeline", "claims", "communications", "documents"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-crimson text-text" : "border-transparent text-text-soft hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-3">
          <p className="text-text-soft">
            {policies.length} polic{policies.length === 1 ? "y" : "ies"} · {opportunities.length} open opportunit
            {opportunities.length === 1 ? "y" : "ies"} · {claims.filter((c) => c.stage !== "settled").length} active
            claim(s) · {comms.length} logged communication(s).
          </p>
          <p className="text-sm">
            <span className="font-semibold text-text">Portal access: </span>
            {client.portal_user_id ? (
              <span className="text-gold-text">Active</span>
            ) : (
              <span className="text-text-soft">
                Not yet activated — it links automatically the first time {client.full_name} logs in with phone{" "}
                {client.phone} at the client portal.
              </span>
            )}
          </p>
        </div>
      )}
      {tab === "policies" && (
        <PoliciesTab
          clientId={client.id}
          clientName={client.full_name}
          clientPhone={client.phone}
          policies={policies}
          onChange={loadAll}
        />
      )}
      {tab === "pipeline" && <PipelineTab clientId={client.id} opportunities={opportunities} onChange={loadAll} />}
      {tab === "claims" && <ClaimsTab clientId={client.id} policies={policies} claims={claims} onChange={loadAll} />}
      {tab === "communications" && <CommunicationsTab clientId={client.id} comms={comms} onChange={loadAll} />}
      {tab === "documents" && <DocumentsTab clientId={client.id} docs={docs} onChange={loadAll} />}
    </PortalLayout>
  );
}

// Rendered off-screen at all times; packages/ui's print stylesheet
// (apps/crm/src/index.css) makes this the only visible thing when the
// user prints, regardless of which tab is open on screen.
function PrintableClientSummary({ client, policies }: { client: Client; policies: ClientPolicy[] }) {
  return (
    <div className="print-only text-black">
      <div className="mb-6 flex items-center justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-xl font-bold">Aangi Associates</p>
          <p className="text-xs">Policy Summary — Generated {formatDate(new Date().toISOString())}</p>
        </div>
        <p className="text-xs">+91 90331 32791</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 text-sm">
        <p>
          <span className="font-semibold">Client:</span> {client.full_name}
        </p>
        <p>
          <span className="font-semibold">Phone:</span> {client.phone}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {client.email ?? "—"}
        </p>
        <p>
          <span className="font-semibold">City:</span> {client.city ?? "—"}
        </p>
        {client.household_name && (
          <p>
            <span className="font-semibold">Household:</span> {client.household_name}
          </p>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1.5 pr-2">Product</th>
            <th className="py-1.5 pr-2">Insurer</th>
            <th className="py-1.5 pr-2">Policy No.</th>
            <th className="py-1.5 pr-2 text-right">Sum Assured</th>
            <th className="py-1.5 pr-2 text-right">Premium</th>
            <th className="py-1.5 pr-2">Renewal</th>
            <th className="py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {policies.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-3 text-text-soft">
                No policies on file.
              </td>
            </tr>
          ) : (
            policies.map((p) => (
              <tr key={p.id} className="border-b border-black/20">
                <td className="py-1.5 pr-2">{p.product_type}</td>
                <td className="py-1.5 pr-2">{p.insurer}</td>
                <td className="py-1.5 pr-2">{p.policy_number ?? "—"}</td>
                <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatINR(p.sum_assured)}</td>
                <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatINR(p.premium)}</td>
                <td className="py-1.5 pr-2">{formatDate(p.renewal_date)}</td>
                <td className="py-1.5 capitalize">{p.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="mt-8 text-[10px] text-text-soft">
        This is a records summary generated from Aangi Associates' internal CRM for reference during a meeting or for
        your own filing — it is not a policy document. Please refer to your original policy bond and insurer
        communications for the definitive terms of each policy.
      </p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-soft">{label}</p>
      <p className="text-text">{value}</p>
    </div>
  );
}

function PoliciesTab({
  clientId,
  clientName,
  clientPhone,
  policies,
  onChange,
}: {
  clientId: string;
  clientName: string;
  clientPhone: string;
  policies: ClientPolicy[];
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const advisorName = profile?.full_name || "Jainik Shah";
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownloadSummary(policy: ClientPolicy) {
    setDownloadingId(policy.id);
    try {
      await exportPolicySummaryPdf(clientName, policy, advisorName);
    } catch (err) {
      showToast(`Failed to generate PDF: ${err instanceof Error ? err.message : "unknown error"}`, "error");
    }
    setDownloadingId(null);
  }
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState({
    policy_number: "",
    insurer: "TATA AIA",
    product_type: PRODUCT_TYPES[0],
    sum_assured: "",
    premium: "",
    start_date: "",
    renewal_date: "",
    category_id: "",
  });
  // The original PDF, held in memory from the moment it's chosen until the
  // form is saved — attached to the client's Documents tab alongside the
  // policy row it was read from, same as a manual Documents-tab upload
  // would be, just in one step instead of two.
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  async function handlePdfUpload(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("client_id", clientId);
      formData.append("file", file);
      const result = await api.postForm<PolicyExtractResult>("/policy_extract.php", formData);
      setForm((f) => ({
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
        category_id: f.category_id,
      }));
      setPendingPdf(file);
      setShowForm(true);
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

  // The category (Life/Health/General/Mutual Funds/…) that ties this
  // policy's actual business to Business Planning targets — see
  // client_policies.category_id and business_plans.php's achievement query.
  useEffect(() => {
    api
      .get<ProductCategory[]>("/product_categories.php")
      .then((rows) => setCategories(rows ?? []))
      .catch(() => setCategories([]));
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/client_policies.php", {
        client_id: clientId,
        policy_number: form.policy_number || null,
        insurer: form.insurer,
        product_type: form.product_type,
        sum_assured: form.sum_assured ? Number(form.sum_assured) : null,
        premium: form.premium ? Number(form.premium) : null,
        start_date: form.start_date || null,
        renewal_date: form.renewal_date || null,
        category_id: form.category_id || null,
      });
      if (pendingPdf) {
        const docForm = new FormData();
        docForm.append("client_id", clientId);
        docForm.append("file", pendingPdf);
        // Best-effort: the policy itself is already saved at this point, so
        // a failure here only means the PDF has to be attached by hand
        // afterwards via the Documents tab — never worth losing the policy
        // record over.
        await api.postForm("/documents.php", docForm).catch(() => {
          showToast("Policy saved, but attaching the original PDF to Documents failed — please upload it there by hand.", "error");
        });
      }
    } catch (err) {
      setSaving(false);
      showToast(`Failed to add policy: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    showToast("Policy added.");
    setShowForm(false);
    setPendingPdf(null);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() => {
            if (showForm) setPendingPdf(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Cancel" : "Add Policy"}
        </Button>
        <Button asChild variant="ghost" size="sm" disabled={extracting}>
          <label htmlFor="policy-pdf-upload" className="cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> {extracting ? "Reading PDF…" : "Upload Policy PDF"}
          </label>
        </Button>
        <input
          id="policy-pdf-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={extracting}
          onChange={(e) => void handlePdfUpload(e)}
        />
      </div>

      {showForm && (
        <Card className="max-w-2xl">
          {pendingPdf && (
            <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-text-soft">
              Pre-filled from <span className="font-medium text-text">{pendingPdf.name}</span> — check every
              field below before saving; this PDF will be attached to the client's Documents tab automatically.
            </p>
          )}
          <form onSubmit={(e) => void handleAdd(e)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Policy Number</Label>
              <Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Insurer</Label>
              <Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Product Type</Label>
              <Select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })}>
                {PRODUCT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sum Assured (₹)</Label>
              <Input
                type="number"
                value={form.sum_assured}
                onChange={(e) => setForm({ ...form, sum_assured: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Premium (₹)</Label>
              <Input
                type="number"
                value={form.premium}
                onChange={(e) => setForm({ ...form, premium: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Renewal Date</Label>
              <Input
                type="date"
                value={form.renewal_date}
                onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Business Planning Category</Label>
              <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Policy"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {policies.length === 0 ? (
        <EmptyState message="No policies yet." icon={ShieldCheck} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Insurer</th>
                <th className="px-4 py-2.5 text-right">Sum Assured</th>
                <th className="px-4 py-2.5">Renewal</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => {
                const dueIn = daysUntil(p.renewal_date);
                const soon = dueIn !== null && dueIn <= 60 && dueIn >= 0;
                const digits = clientPhone.replace(/\D/g, "");
                const waPhone = digits.length === 10 ? `91${digits}` : digits;
                const reminderMessage = `Hi ${clientName}, this is a reminder from Aangi Associates that your ${p.product_type} policy is due for renewal on ${formatDate(p.renewal_date)}. Let us know if you'd like to discuss it.`;
                return (
                  <tr
                    key={p.id}
                    className="border-t border-line odd:bg-surface-2/40 hover:bg-surface-2 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-text">{p.product_type}</td>
                    <td className="px-4 py-2.5 text-text-soft">{p.insurer}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-soft">
                      {formatINR(p.sum_assured)}
                    </td>
                    <td className={`px-4 py-2.5 ${soon ? "font-semibold text-crimson" : "text-text-soft"}`}>
                      {formatDate(p.renewal_date)}
                      {soon ? ` (${dueIn}d)` : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={POLICY_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        {soon && (
                          <a
                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(reminderMessage)}`}
                            target="_blank"
                            rel="noopener"
                            className="text-xs font-medium text-gold-text hover:underline"
                          >
                            Remind via WhatsApp →
                          </a>
                        )}
                        <button
                          type="button"
                          title="Download Policy Detail"
                          disabled={downloadingId === p.id}
                          onClick={() => void handleDownloadSummary(p)}
                          className="text-text-soft hover:text-gold-text disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PipelineTab({
  clientId,
  opportunities,
  onChange,
}: {
  clientId: string;
  opportunities: Opportunity[];
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const [productType, setProductType] = useState(PRODUCT_TYPES[0]);
  const [creating, setCreating] = useState(false);

  async function createOpportunity() {
    setCreating(true);
    try {
      await api.post("/opportunities.php", { client_id: clientId, product_type: productType });
    } catch (err) {
      setCreating(false);
      showToast(`Failed to create opportunity: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setCreating(false);
    showToast("Opportunity created.");
    onChange();
  }

  async function advanceStage(opp: Opportunity, stage: Opportunity["stage"]) {
    try {
      await api.put(`/opportunities.php?id=${opp.id}`, { stage, updated_at: new Date().toISOString() });
    } catch (err) {
      showToast(`Failed to update stage: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>New opportunity — product</Label>
          <Select value={productType} onChange={(e) => setProductType(e.target.value)}>
            {PRODUCT_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" onClick={() => void createOpportunity()} disabled={creating}>
          {creating ? "Creating…" : "Start Opportunity"}
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState message="No open opportunities." icon={TrendingUp} />
      ) : (
        <div className="space-y-3">
          {opportunities.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-text">{o.product_type}</p>
                <Select
                  value={o.stage}
                  onChange={(e) => void advanceStage(o, e.target.value as Opportunity["stage"])}
                  className="w-48"
                >
                  {OPPORTUNITY_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " / ")}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-1">
                {OPPORTUNITY_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded ${
                      OPPORTUNITY_STAGES.indexOf(o.stage) >= i ? "bg-crimson" : "bg-surface-2"
                    }`}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimsTab({
  clientId,
  policies,
  claims,
  onChange,
}: {
  clientId: string;
  policies: ClientPolicy[];
  claims: Claim[];
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const [policyId, setPolicyId] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function fileClaim() {
    setCreating(true);
    try {
      await api.post("/claims.php", { client_id: clientId, policy_id: policyId || null, notes: notes || null });
    } catch (err) {
      setCreating(false);
      showToast(`Failed to file claim: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setCreating(false);
    showToast("Claim filed — notified stage.");
    setNotes("");
    onChange();
  }

  async function advanceStage(claim: Claim, stage: Claim["stage"]) {
    try {
      await api.put(`/claims.php?id=${claim.id}`, {
        stage,
        settled_at: stage === "settled" ? new Date().toISOString() : null,
      });
    } catch (err) {
      showToast(`Failed to update claim: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    onChange();
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-xl space-y-3 p-4">
        <p className="font-medium text-text">File a new claim</p>
        <div className="space-y-1.5">
          <Label>Policy (optional)</Label>
          <Select value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">No specific policy</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_type} {p.policy_number ? `(${p.policy_number})` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => void fileClaim()} disabled={creating}>
          {creating ? "Filing…" : "File Claim"}
        </Button>
      </Card>

      {claims.length === 0 ? (
        <EmptyState message="No claims on file." icon={ShieldAlert} />
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-text-soft">Notified {formatDate(c.notified_at)}</p>
                <Select
                  value={c.stage}
                  onChange={(e) => void advanceStage(c, e.target.value as Claim["stage"])}
                  className="w-48"
                >
                  {CLAIM_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              {c.notes && <p className="text-sm text-text">{c.notes}</p>}
              <div className="mt-2 flex gap-1">
                {CLAIM_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded ${CLAIM_STAGES.indexOf(c.stage) >= i ? "bg-gold" : "bg-surface-2"}`}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunicationsTab({
  clientId,
  comms,
  onChange,
}: {
  clientId: string;
  comms: Communication[];
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const [channel, setChannel] = useState<Communication["channel"]>("whatsapp");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function logComm() {
    if (!notes.trim()) {
      showToast("Add a note before logging.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/communications.php", { client_id: clientId, channel, notes });
    } catch (err) {
      setSaving(false);
      showToast(`Failed to log: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    setNotes("");
    onChange();
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-xl space-y-3 p-4">
        <div className="flex gap-3">
          <Select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Communication["channel"])}
            className="w-40"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="other">Other</option>
          </Select>
          <Input placeholder="What was discussed?" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => void logComm()} disabled={saving}>
          {saving ? "Logging…" : "Log Touchpoint"}
        </Button>
      </Card>

      {comms.length === 0 ? (
        <EmptyState message="No communications logged yet." icon={MessageCircle} />
      ) : (
        <ul className="space-y-2">
          {comms.map((c) => (
            <li key={c.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
              <span className="font-medium capitalize text-gold-text">{c.channel}</span>{" "}
              <span className="text-text-soft">· {formatDate(c.occurred_at)}</span>
              <p className="text-text">{c.notes}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentsTab({
  clientId,
  docs,
  onChange,
}: {
  clientId: string;
  docs: ClientDocument[];
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("client_id", clientId);
      form.append("file", file);
      await api.postForm("/documents.php", form);
      showToast("Document uploaded.");
      onChange();
    } catch (err) {
      showToast(`Failed to upload: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.del(`/documents.php?id=${id}`);
      showToast("Document deleted.");
      onChange();
    } catch (err) {
      showToast(`Failed to delete: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-xl p-4">
        <Label htmlFor="doc-upload" className="mb-2 block">
          Upload a document
        </Label>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" disabled={uploading}>
            <label htmlFor="doc-upload" className="cursor-pointer">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Choose file"}
            </label>
          </Button>
          <input
            id="doc-upload"
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void handleUpload(e)}
          />
          <p className="text-xs text-text-soft">Policy PDFs, ID proof, etc. — 10MB max.</p>
        </div>
      </Card>

      {docs.length === 0 ? (
        <EmptyState message="No documents uploaded yet." icon={FileText} />
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-gold-text" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-text">{d.original_name}</p>
                <p className="text-xs text-text-soft">
                  {formatFileSize(d.size_bytes)} · {formatDate(d.created_at)}
                  {d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ""}
                </p>
              </div>
              <a
                href={`${API_BASE}/documents.php?download=${d.id}`}
                className="shrink-0 rounded-md p-1.5 text-text-soft hover:bg-surface-2 hover:text-text"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                disabled={deletingId === d.id}
                onClick={() => void handleDelete(d.id)}
                className="shrink-0 rounded-md p-1.5 text-text-soft hover:bg-surface-2 hover:text-crimson"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
