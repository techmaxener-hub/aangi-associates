import { formatINR, formatINRCompact } from "../../lib/format";
import type { Filters, MeasureBag, MeasureMeta, PivotConfig } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03" → "Mar 2026"; "in_progress" → "In progress"; everything else unchanged. */
export function formatKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
  if (/^[a-z]+(_[a-z]+)+$/.test(key) || /^[a-z]+$/.test(key)) {
    const s = key.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return key;
}

/** Value of a measure inside a bag of raw sums (handles derived ratios). null = undefined (e.g. 0/0). */
export function measureValue(bag: MeasureBag | undefined, m: MeasureMeta): number | null {
  if (!bag) return 0;
  if (m.ratio) {
    const den = bag[m.ratio[1]] ?? 0;
    return den > 0 ? ((bag[m.ratio[0]] ?? 0) / den) * 100 : null;
  }
  return bag[m.key] ?? 0;
}

export function formatMeasure(v: number | null, m: MeasureMeta): string {
  if (v === null) return "—";
  if (m.format === "inr") return formatINRCompact(v);
  if (m.format === "pct") return `${v.toFixed(1)}%`;
  return Math.round(v).toLocaleString("en-IN");
}

/** Exact (non-abbreviated) value for tooltips. */
export function formatMeasureExact(v: number | null, m: MeasureMeta): string {
  if (v === null) return "no data";
  if (m.format === "inr") return formatINR(v);
  if (m.format === "pct") return `${v.toFixed(2)}%`;
  return Math.round(v).toLocaleString("en-IN");
}

// ---- URL <-> config (so a view can be bookmarked or sent to someone) ----------

export function configToParams(c: PivotConfig): URLSearchParams {
  const p = new URLSearchParams();
  p.set("fact", c.fact);
  p.set("rows", c.rows);
  if (c.cols) p.set("cols", c.cols);
  p.set("m", c.measure);
  p.set("view", c.view);
  if (Object.keys(c.filters).length) p.set("f", JSON.stringify(c.filters));
  return p;
}

export function paramsToConfig(p: URLSearchParams): Partial<PivotConfig> | null {
  const fact = p.get("fact");
  const rows = p.get("rows");
  if ((fact !== "policies" && fact !== "leads") || !rows) return null;
  let filters: Filters = {};
  try {
    const raw = JSON.parse(p.get("f") ?? "{}") as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (Array.isArray(v)) filters[k] = v.map(String);
      }
    }
  } catch {
    filters = {};
  }
  return {
    fact,
    rows,
    cols: p.get("cols") ?? "",
    measure: p.get("m") ?? "n",
    view: p.get("view") === "chart" ? "chart" : "table",
    filters,
  };
}

export const DEFAULT_CONFIG: Record<"policies" | "leads", PivotConfig> = {
  policies: { fact: "policies", rows: "segment", cols: "start_year", measure: "n", view: "table", filters: { status: ["active"] } },
  leads: { fact: "leads", rows: "source", cols: "status", measure: "n", view: "table", filters: {} },
};

export const PRESETS: { label: string; hint: string; config: PivotConfig }[] = [
  {
    label: "Premium by business line × year",
    hint: "How much annual premium each line wrote, per year",
    config: { fact: "policies", rows: "segment", cols: "start_year", measure: "annual_premium", view: "table", filters: { status: ["active"] } },
  },
  {
    label: "Who sells what",
    hint: "Policies per associate, split by business line",
    config: { fact: "policies", rows: "associate", cols: "segment", measure: "n", view: "chart", filters: { status: ["active"] } },
  },
  {
    label: "Renewals coming up",
    hint: "Policies falling due per month, by business line",
    config: { fact: "policies", rows: "renewal_month", cols: "segment", measure: "n", view: "chart", filters: { status: ["active"] } },
  },
  {
    label: "Where clients live",
    hint: "Clients per city, by business line",
    config: { fact: "policies", rows: "city", cols: "segment", measure: "clients", view: "table", filters: { status: ["active"] } },
  },
  {
    label: "Insurer concentration",
    hint: "How premium is spread across insurers",
    config: { fact: "policies", rows: "insurer", cols: "", measure: "annual_premium", view: "chart", filters: { status: ["active"] } },
  },
  {
    label: "Source × outcome",
    hint: "What happens to leads from each channel",
    config: { fact: "leads", rows: "source", cols: "status", measure: "n", view: "table", filters: {} },
  },
  {
    label: "Conversion by associate",
    hint: "Share of assigned leads that became clients",
    config: { fact: "leads", rows: "associate", cols: "", measure: "conversion_pct", view: "chart", filters: {} },
  },
  {
    label: "Best channel per product",
    hint: "Conversion rate of each source, by lead type",
    config: { fact: "leads", rows: "source", cols: "lead_type", measure: "conversion_pct", view: "table", filters: {} },
  },
  {
    label: "Lead flow by month",
    hint: "New leads per month, by lead type",
    config: { fact: "leads", rows: "created_month", cols: "lead_type", measure: "n", view: "chart", filters: {} },
  },
];
