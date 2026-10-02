import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { FolderArchive, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { PortalLayout, type NavItem } from "../../portals/PortalLayout";
import { PRODUCT_TYPES, type Client } from "./types";

// Mirrors bulk_policy_import.php's two-step, never-auto-save shape: upload
// a .zip of policy PDFs (action=scan) and get back one row per file with a
// SUGGESTED client match + guessed fields — nothing is saved yet. Review
// and correct each row, choose which ones to actually import, then commit
// (action=commit). A row with no client chosen is simply skipped.

interface ScanField {
  insurer: string | null;
  product_type: string | null;
  policy_number: string | null;
  sum_assured: number | null;
  premium: number | null;
  start_date: string | null;
  renewal_date: string | null;
  insured_name: string | null;
}

interface ScanFileResult {
  entry_name: string;
  status: "ready" | "skipped";
  skip_reason?: string;
  low_confidence?: boolean;
  fields?: ScanField;
  suggested_client_id?: string | null;
  suggested_client_name?: string | null;
  match_score?: number | null;
}

interface ScanResponse {
  batch_id: string;
  files: ScanFileResult[];
}

// The reviewer's editable decision for one "ready" row — starts from the
// server's suggestion/guess, but every field here can be corrected before
// commit, same as the single-PDF-upload flow in ClientDetailPage.tsx.
interface Row {
  entry_name: string;
  low_confidence: boolean;
  client_id: string; // "" = skip this file
  suggested_client_name: string | null;
  match_score: number | null;
  policy_number: string;
  insurer: string;
  product_type: string;
  sum_assured: string;
  premium: string;
  start_date: string;
  renewal_date: string;
}

export function BulkImportPage({ navItems, basePath }: { navItems: NavItem[]; basePath: string }) {
  const { showToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [skippedFiles, setSkippedFiles] = useState<ScanFileResult[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [imported, setImported] = useState<number | null>(null);

  async function handleZipChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setScanning(true);
    setImported(null);
    try {
      const [clientRows, scan] = await Promise.all([
        clients.length ? Promise.resolve(clients) : api.get<Client[]>("/clients.php?picker=1"),
        (async () => {
          const form = new FormData();
          form.append("file", file);
          return api.postForm<ScanResponse>("/bulk_policy_import.php?action=scan", form);
        })(),
      ]);
      setClients(clientRows ?? []);
      setBatchId(scan.batch_id);
      const ready = scan.files.filter((f): f is ScanFileResult & { fields: ScanField } => f.status === "ready" && !!f.fields);
      setRows(
        ready.map((f) => ({
          entry_name: f.entry_name,
          low_confidence: !!f.low_confidence,
          client_id: f.suggested_client_id ?? "",
          suggested_client_name: f.suggested_client_name ?? null,
          match_score: f.match_score ?? null,
          policy_number: f.fields.policy_number ?? "",
          insurer: f.fields.insurer ?? "TATA AIA",
          product_type: f.fields.product_type && PRODUCT_TYPES.includes(f.fields.product_type) ? f.fields.product_type : PRODUCT_TYPES[0],
          sum_assured: f.fields.sum_assured != null ? String(f.fields.sum_assured) : "",
          premium: f.fields.premium != null ? String(f.fields.premium) : "",
          start_date: f.fields.start_date ?? "",
          renewal_date: f.fields.renewal_date ?? "",
        })),
      );
      setSkippedFiles(scan.files.filter((f) => f.status === "skipped"));
      showToast(`Scanned ${scan.files.length} file(s) in the ZIP — review each row below before importing.`);
    } catch (err) {
      showToast(`Failed to scan ZIP: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setScanning(false);
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleCommit() {
    if (!batchId) return;
    const decisions = rows
      .filter((r) => r.client_id) // no client chosen = explicitly skipped
      .map((r) => ({
        entry_name: r.entry_name,
        client_id: r.client_id,
        policy_number: r.policy_number || null,
        insurer: r.insurer,
        product_type: r.product_type,
        sum_assured: r.sum_assured ? Number(r.sum_assured) : null,
        premium: r.premium ? Number(r.premium) : null,
        start_date: r.start_date || null,
        renewal_date: r.renewal_date || null,
      }));
    if (!decisions.length) {
      showToast("Choose a client for at least one file before importing.", "error");
      return;
    }
    setCommitting(true);
    try {
      const result = await api.post<{ imported: { entry_name: string }[]; errors: { entry_name: string; error: string }[] }>(
        "/bulk_policy_import.php?action=commit",
        { batch_id: batchId, decisions },
      );
      setImported(result.imported.length);
      if (result.errors.length) {
        showToast(`Imported ${result.imported.length}, but ${result.errors.length} failed — see details below.`, "error");
      } else {
        showToast(`Imported ${result.imported.length} polic${result.imported.length === 1 ? "y" : "ies"}.`);
      }
      // A batch is single-use server-side (its ZIP is deleted after commit),
      // so clear the working state rather than let a stale batch_id linger.
      setBatchId(null);
      setRows([]);
      setSkippedFiles([]);
      if (result.errors.length) {
        setSkippedFiles(result.errors.map((e) => ({ entry_name: e.entry_name, status: "skipped", skip_reason: e.error })));
      }
    } catch (err) {
      showToast(`Failed to import: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
    }
    setCommitting(false);
  }

  return (
    <PortalLayout
      title="Bulk Import"
      navItems={navItems}
      breadcrumbs={[{ label: "My Clients", href: `${basePath}/clients` }, { label: "Bulk Import" }]}
    >
      <Card className="mb-6 max-w-2xl p-4">
        <Label htmlFor="bulk-zip-upload" className="mb-2 block">
          Upload a .zip of policy PDFs
        </Label>
        <p className="mb-3 text-xs text-text-soft">
          Each PDF is matched to an existing client by the name found inside it (or, failing that, the file's own
          name) — always a suggestion to review below, never saved automatically. Files that aren't PDFs, or can't be
          matched or read, are listed separately so nothing silently disappears.
        </p>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" disabled={scanning}>
            <label htmlFor="bulk-zip-upload" className="cursor-pointer">
              <FolderArchive className="h-3.5 w-3.5" /> {scanning ? "Scanning…" : "Choose ZIP file"}
            </label>
          </Button>
          <input
            id="bulk-zip-upload"
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            disabled={scanning}
            onChange={(e) => void handleZipChosen(e)}
          />
        </div>
      </Card>

      {imported !== null && (
        <Card className="mb-6 max-w-2xl p-4 text-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Imported {imported} polic{imported === 1 ? "y" : "ies"}.
          </div>
          <Link to={`${basePath}/clients`} className="mt-1 inline-block text-xs font-medium text-gold-text hover:underline">
            ← Back to My Clients
          </Link>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="mb-6 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-text-soft">
              <tr>
                <th className="px-3 py-2.5">File</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Policy No.</th>
                <th className="px-3 py-2.5">Insurer</th>
                <th className="px-3 py-2.5 text-right">Sum Assured</th>
                <th className="px-3 py-2.5 text-right">Premium</th>
                <th className="px-3 py-2.5">Start</th>
                <th className="px-3 py-2.5">Renewal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.entry_name} className="border-t border-line odd:bg-surface-2/40">
                  <td className="max-w-[160px] truncate px-3 py-2 text-xs text-text-soft" title={r.entry_name}>
                    {r.entry_name}
                    {r.low_confidence && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600" title="Could not read this PDF reliably — fields below are a best guess at most, check carefully">
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={r.client_id}
                      onChange={(e) => updateRow(i, { client_id: e.target.value })}
                      className="min-w-[160px]"
                    >
                      <option value="">— Skip this file —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </Select>
                    {r.suggested_client_name && (
                      <div className="mt-0.5 text-[11px] text-text-soft">
                        suggested: {r.suggested_client_name}
                        {r.match_score != null ? ` (${Math.round(r.match_score * 100)}% match)` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={r.product_type}
                      onChange={(e) => updateRow(i, { product_type: e.target.value })}
                      className="min-w-[150px]"
                    >
                      {PRODUCT_TYPES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-32"
                      value={r.policy_number}
                      onChange={(e) => updateRow(i, { policy_number: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input className="w-28" value={r.insurer} onChange={(e) => updateRow(i, { insurer: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      className="w-28 text-right"
                      value={r.sum_assured}
                      onChange={(e) => updateRow(i, { sum_assured: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      className="w-24 text-right"
                      value={r.premium}
                      onChange={(e) => updateRow(i, { premium: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="date" className="w-36" value={r.start_date} onChange={(e) => updateRow(i, { start_date: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      className="w-36"
                      value={r.renewal_date}
                      onChange={(e) => updateRow(i, { renewal_date: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end border-t border-line p-3">
            <Button onClick={() => void handleCommit()} disabled={committing}>
              {committing ? "Importing…" : `Import ${rows.filter((r) => r.client_id).length} polic${rows.filter((r) => r.client_id).length === 1 ? "y" : "ies"}`}
            </Button>
          </div>
        </Card>
      )}

      {skippedFiles.length > 0 && (
        <Card className="max-w-2xl p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">Not imported</p>
          <ul className="space-y-1 text-sm">
            {skippedFiles.map((f) => (
              <li key={f.entry_name} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-text">{f.entry_name}</span>
                <Badge variant="neutral">{f.skip_reason ?? "skipped"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PortalLayout>
  );
}
