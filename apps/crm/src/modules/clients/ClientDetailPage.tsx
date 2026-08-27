import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { PortalLayout } from "../../portals/PortalLayout";
import { formatINR, formatDate, daysUntil } from "../../lib/format";
import {
  OPPORTUNITY_STAGES,
  CLAIM_STAGES,
  PRODUCT_TYPES,
  type Client,
  type ClientPolicy,
  type Opportunity,
  type Claim,
  type Communication,
} from "./types";

interface NavItem {
  label: string;
  href: string;
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

type Tab = "overview" | "policies" | "pipeline" | "claims" | "communications";

export function ClientDetailPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [policies, setPolicies] = useState<ClientPolicy[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    const [c, p, o, cl, co] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("client_policies").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("opportunities").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("claims").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("communications").select("*").eq("client_id", id).order("occurred_at", { ascending: false }),
    ]);
    if (c.error) showToast(`Failed to load client: ${c.error.message}`, "error");
    setClient(c.data ?? null);
    setPolicies(p.data ?? []);
    setOpportunities(o.data ?? []);
    setClaims(cl.data ?? []);
    setComms(co.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const coveredCategories = new Set(
    policies
      .filter((p) => p.status === "active")
      .map((p) => CATEGORY_MAP[p.product_type])
      .filter(Boolean),
  );
  const gapCategories = ALL_CATEGORIES.filter((cat) => !coveredCategories.has(cat));

  if (loading) {
    return (
      <PortalLayout title="Client" navItems={navItems}>
        <p className="text-text-soft">Loading…</p>
      </PortalLayout>
    );
  }

  if (!client) {
    return (
      <PortalLayout title="Client not found" navItems={navItems}>
        <Link to={`${basePath}/clients`} className="text-gold-text hover:underline">
          ← Back to clients
        </Link>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title={client.full_name} navItems={navItems}>
      <PrintableClientSummary client={client} policies={policies} />

      <div className="mb-4 flex items-center justify-between">
        <Link
          to={`${basePath}/clients`}
          className="inline-flex items-center gap-1 text-sm text-text-soft hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to clients
        </Link>
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print Summary
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4 text-sm">
        <InfoItem label="Phone" value={client.phone} />
        <InfoItem label="Email" value={client.email ?? "—"} />
        <InfoItem label="City" value={client.city ?? "—"} />
        <InfoItem label="Household" value={client.household_name ?? "—"} />
      </div>

      {gapCategories.length > 0 && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-surface-2 p-3 text-xs text-text">
          <span className="font-semibold text-gold-text">Cross-sell signal:</span> no active cover in{" "}
          {gapCategories.join(", ")}.
        </div>
      )}

      <div className="mb-6 flex gap-2 border-b border-line">
        {(["overview", "policies", "pipeline", "claims", "communications"] as Tab[]).map((t) => (
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
            <th className="py-1.5 pr-2">Sum Assured</th>
            <th className="py-1.5 pr-2">Premium</th>
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
                <td className="py-1.5 pr-2">{formatINR(p.sum_assured)}</td>
                <td className="py-1.5 pr-2">{formatINR(p.premium)}</td>
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
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    policy_number: "",
    insurer: "TATA AIA",
    product_type: PRODUCT_TYPES[0],
    sum_assured: "",
    premium: "",
    start_date: "",
    renewal_date: "",
  });

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("client_policies").insert({
      client_id: clientId,
      policy_number: form.policy_number || null,
      insurer: form.insurer,
      product_type: form.product_type,
      sum_assured: form.sum_assured ? Number(form.sum_assured) : null,
      premium: form.premium ? Number(form.premium) : null,
      start_date: form.start_date || null,
      renewal_date: form.renewal_date || null,
    });
    setSaving(false);
    if (error) {
      showToast(`Failed to add policy: ${error.message}`, "error");
      return;
    }
    showToast("Policy added.");
    setShowForm(false);
    onChange();
  }

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "Add Policy"}
      </Button>

      {showForm && (
        <Card className="max-w-2xl">
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
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Policy"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {policies.length === 0 ? (
        <p className="text-text-soft">No policies yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Insurer</th>
                <th className="px-4 py-2.5">Sum Assured</th>
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
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-2.5 text-text">{p.product_type}</td>
                    <td className="px-4 py-2.5 text-text-soft">{p.insurer}</td>
                    <td className="px-4 py-2.5 text-text-soft">{formatINR(p.sum_assured)}</td>
                    <td className={`px-4 py-2.5 ${soon ? "font-semibold text-crimson" : "text-text-soft"}`}>
                      {formatDate(p.renewal_date)}
                      {soon ? ` (${dueIn}d)` : ""}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-text-soft">{p.status}</td>
                    <td className="px-4 py-2.5 text-right">
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
    const { error } = await supabase.from("opportunities").insert({ client_id: clientId, product_type: productType });
    setCreating(false);
    if (error) {
      showToast(`Failed to create opportunity: ${error.message}`, "error");
      return;
    }
    showToast("Opportunity created.");
    onChange();
  }

  async function advanceStage(opp: Opportunity, stage: Opportunity["stage"]) {
    const { error } = await supabase
      .from("opportunities")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", opp.id);
    if (error) {
      showToast(`Failed to update stage: ${error.message}`, "error");
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
        <p className="text-text-soft">No open opportunities.</p>
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
    const { error } = await supabase.from("claims").insert({
      client_id: clientId,
      policy_id: policyId || null,
      notes: notes || null,
    });
    setCreating(false);
    if (error) {
      showToast(`Failed to file claim: ${error.message}`, "error");
      return;
    }
    showToast("Claim filed — notified stage.");
    setNotes("");
    onChange();
  }

  async function advanceStage(claim: Claim, stage: Claim["stage"]) {
    const { error } = await supabase
      .from("claims")
      .update({ stage, settled_at: stage === "settled" ? new Date().toISOString() : null })
      .eq("id", claim.id);
    if (error) {
      showToast(`Failed to update claim: ${error.message}`, "error");
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
        <p className="text-text-soft">No claims on file.</p>
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
    const { error } = await supabase.from("communications").insert({ client_id: clientId, channel, notes });
    setSaving(false);
    if (error) {
      showToast(`Failed to log: ${error.message}`, "error");
      return;
    }
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
        <p className="text-text-soft">No communications logged yet.</p>
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
