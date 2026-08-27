import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";

const TEMPLATE_HEADERS = ["full_name", "phone", "email", "city", "lead_type"];

interface ParsedRow {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  lead_type: string;
  isDuplicate: boolean;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? "";
    });
    return row;
  });
}

async function parseXlsx(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  // Dynamically imported — xlsx is a large library, no need to ship it in
  // the main bundle for admins who only ever use CSV.
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((row) => {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[key.trim().toLowerCase()] = String(value ?? "").trim();
    });
    return normalized;
  });
}

async function parseFile(file: File): Promise<Record<string, string>[]> {
  if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return await parseXlsx(buffer);
  }
  const text = await file.text();
  return parseCsv(text);
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), "Rajesh Patel,9876543210,rajesh@example.com,Ahmedabad,Term"].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aangi-leads-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkLeadUpload() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dedupe, setDedupe] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const parsed = await parseFile(file);

    const phones = parsed.map((r) => r.phone).filter(Boolean);
    const emails = parsed.map((r) => r.email).filter(Boolean);

    let existingPhones = new Set<string>();
    let existingEmails = new Set<string>();

    if (dedupe && (phones.length || emails.length)) {
      const { data } = await supabase.from("leads").select("phone, email").or(
        [phones.length ? `phone.in.(${phones.join(",")})` : null, emails.length ? `email.in.(${emails.join(",")})` : null]
          .filter(Boolean)
          .join(","),
      );
      existingPhones = new Set((data ?? []).map((r) => r.phone).filter(Boolean));
      existingEmails = new Set((data ?? []).map((r) => r.email).filter(Boolean));
    }

    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    const withDuplicates: ParsedRow[] = parsed.map((r) => {
      const isDuplicate =
        (!!r.phone && (existingPhones.has(r.phone) || seenPhones.has(r.phone))) ||
        (!!r.email && (existingEmails.has(r.email) || seenEmails.has(r.email)));
      if (r.phone) seenPhones.add(r.phone);
      if (r.email) seenEmails.add(r.email);
      return {
        full_name: r.full_name ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        city: r.city ?? "",
        lead_type: r.lead_type ?? "",
        isDuplicate: dedupe && isDuplicate,
      };
    });

    setRows(withDuplicates);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleImport() {
    const toImport = rows.filter((r) => !r.isDuplicate && r.full_name && r.phone);
    if (toImport.length === 0) {
      showToast("Nothing to import — all rows are duplicates or missing name/phone.", "error");
      return;
    }

    setImporting(true);
    const { error } = await supabase.from("leads").insert(
      toImport.map((r) => ({
        full_name: r.full_name,
        phone: r.phone,
        email: r.email || null,
        city: r.city || null,
        lead_type: r.lead_type || null,
        source: "bulk_upload",
        created_by: session?.user.id ?? null,
      })),
    );
    setImporting(false);

    if (error) {
      showToast(`Import failed: ${error.message}`, "error");
      return;
    }

    showToast(`Imported ${toImport.length} lead(s).`);
    setRows([]);
  }

  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base text-text">
            <UploadCloud className="h-5 w-5 text-gold" /> Bulk Lead Import
          </h2>
          <p className="text-xs text-text-soft">CSV or Excel — columns: full_name, phone, email, city, lead_type.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5" /> Sample CSV
        </Button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? "border-gold bg-surface-2" : "border-line-strong"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-text-soft" />
        <p className="text-sm font-semibold text-text">Drag & drop your CSV or Excel file here, or click to browse</p>
        <p className="mt-1 text-xs text-text-soft">Accepts .csv, .xlsx, and .xls.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 p-3 text-xs">
        <span className="flex items-center gap-2 text-text">
          <ShieldCheck className="h-4 w-4 text-gold" /> Skip duplicate phone/email against existing leads
        </span>
        <input
          type="checkbox"
          checked={dedupe}
          onChange={(e) => setDedupe(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong"
        />
      </label>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="max-h-64 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2 text-text-soft">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2">{r.full_name}</td>
                    <td className="px-3 py-2">{r.phone}</td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.city}</td>
                    <td className="px-3 py-2">{r.lead_type}</td>
                    <td className="px-3 py-2">
                      {r.isDuplicate ? (
                        <span className="text-crimson">Duplicate — skipped</span>
                      ) : (
                        <span className="text-gold">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-soft">
              {rows.length} row(s) parsed{duplicateCount > 0 ? `, ${duplicateCount} duplicate(s) will be skipped` : ""}.
            </p>
            <Button onClick={() => void handleImport()} disabled={importing}>
              {importing ? "Importing…" : `Import ${rows.length - duplicateCount} Lead(s)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
