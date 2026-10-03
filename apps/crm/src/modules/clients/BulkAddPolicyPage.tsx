import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { PRODUCT_TYPES, type Client } from "./types";

// "+ Add Bulk Policies" — manual bulk entry, no PDF involved (that's
// BulkImportPage.tsx's job). Deliberately a plain repeatable-row grid,
// nothing fancier: each row picks its own client (so one batch can cover
// several different clients, or the same client several times), fills in
// the same fields PoliciesTab's single Add Policy form already uses, and
// "Save All" posts each valid row to client_policies.php in turn.

interface Row {
  key: number;
  client_id: string;
  policy_number: string;
  insurer: string;
  product_type: string;
  sum_assured: string;
  premium: string;
  start_date: string;
  renewal_date: string;
}

let nextKey = 1;
function emptyRow(): Row {
  return {
    key: nextKey++,
    client_id: "",
    policy_number: "",
    insurer: "TATA AIA",
    product_type: PRODUCT_TYPES[0],
    sum_assured: "",
    premium: "",
    start_date: "",
    renewal_date: "",
  };
}

export function BulkAddPolicyPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Client[]>("/clients.php?picker=1")
      .then((c) => setClients(c ?? []))
      .catch(() => setClients([]));
  }, []);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSaveAll() {
    const valid = rows.filter((r) => r.client_id);
    if (!valid.length) {
      showToast("Pick a client on at least one row before saving.", "error");
      return;
    }
    setSaving(true);
    setSavedCount(null);
    let ok = 0;
    const errors: string[] = [];
    for (const r of valid) {
      try {
        await api.post("/client_policies.php", {
          client_id: r.client_id,
          policy_number: r.policy_number || null,
          insurer: r.insurer,
          product_type: r.product_type,
          sum_assured: r.sum_assured ? Number(r.sum_assured) : null,
          premium: r.premium ? Number(r.premium) : null,
          start_date: r.start_date || null,
          renewal_date: r.renewal_date || null,
        });
        ok++;
      } catch (err) {
        errors.push(err instanceof ApiError ? err.message : "unknown error");
      }
    }
    setSaving(false);
    setSavedCount(ok);
    if (errors.length) {
      showToast(`Saved ${ok} of ${valid.length} — ${errors.length} failed.`, "error");
    } else {
      showToast(`Saved ${ok} polic${ok === 1 ? "y" : "ies"}.`);
      setRows([emptyRow(), emptyRow(), emptyRow()]);
    }
  }

  return (
    <PortalLayout
      title="Add Bulk Policies"
      navItems={navItems}
      breadcrumbs={[{ label: "My Clients", href: `${basePath}/clients` }, { label: "Add Bulk Policies" }]}
    >
      <p className="mb-4 max-w-2xl text-sm text-text-soft">
        Pick a client per row (the same client can appear more than once) and fill in whatever fields you have — only
        the client is required. Nothing is saved until you press "Save All".
      </p>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
            <tr>
              <th className="px-3 py-2.5">Client</th>
              <th className="px-3 py-2.5">Product Type</th>
              <th className="px-3 py-2.5">Insurer</th>
              <th className="px-3 py-2.5">Policy No.</th>
              <th className="px-3 py-2.5">Sum Assured</th>
              <th className="px-3 py-2.5">Premium</th>
              <th className="px-3 py-2.5">Start</th>
              <th className="px-3 py-2.5">End</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line odd:bg-surface-2/40">
                <td className="px-3 py-2">
                  <Select className="min-w-[150px]" value={r.client_id} onChange={(e) => updateRow(r.key, { client_id: e.target.value })}>
                    <option value="">— Client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select className="min-w-[140px]" value={r.product_type} onChange={(e) => updateRow(r.key, { product_type: e.target.value })}>
                    {PRODUCT_TYPES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input className="w-28" value={r.insurer} onChange={(e) => updateRow(r.key, { insurer: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input className="w-32" value={r.policy_number} onChange={(e) => updateRow(r.key, { policy_number: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" className="w-28" value={r.sum_assured} onChange={(e) => updateRow(r.key, { sum_assured: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" className="w-24" value={r.premium} onChange={(e) => updateRow(r.key, { premium: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" className="w-36" value={r.start_date} onChange={(e) => updateRow(r.key, { start_date: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" className="w-36" value={r.renewal_date} onChange={(e) => updateRow(r.key, { renewal_date: e.target.value })} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    title="Remove row"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== r.key) : prev))}
                    className="text-text-soft hover:text-crimson"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-line p-3">
          <Button variant="ghost" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
          <Button onClick={() => void handleSaveAll()} disabled={saving}>
            {saving ? "Saving…" : "Save All"}
          </Button>
        </div>
      </Card>

      {savedCount !== null && (
        <p className="mt-4 text-sm text-text-soft">
          Saved {savedCount} polic{savedCount === 1 ? "y" : "ies"} in this batch.
        </p>
      )}
    </PortalLayout>
  );
}
