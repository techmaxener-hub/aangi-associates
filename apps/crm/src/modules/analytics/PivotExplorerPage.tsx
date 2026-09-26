import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, BarChart3, Download, Filter, Sparkles, Table2, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { formatDate, formatINR } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Select } from "../../components/ui/select";
import { PortalLayout } from "../../portals/PortalLayout";
import { adminNavItems } from "../../portals/admin/nav";
import { PivotChart, PivotTable } from "./PivotViews";
import { DEFAULT_CONFIG, PRESETS, configToParams, formatKey, formatMeasure, measureValue, paramsToConfig } from "./pivotFormat";
import type { DrillResult, Fact, Filters, PivotConfig, PivotMeta, PivotResult } from "./types";

const FACT_LABEL: Record<Fact, string> = { policies: "Policies", leads: "Leads" };

interface Drill {
  r: string | null;
  c: string | null;
}

export function PivotExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta, setMeta] = useState<PivotMeta | null>(null);
  const [config, setConfig] = useState<PivotConfig>(() => ({ ...DEFAULT_CONFIG.policies, ...(paramsToConfig(searchParams) ?? {}) }) as PivotConfig);
  const [result, setResult] = useState<PivotResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [drillData, setDrillData] = useState<DrillResult | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    api.get<PivotMeta>("/pivot.php?meta=1").then(setMeta).catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the explorer."));
  }, []);

  // Keep the address bar in step with the configuration so a view can be bookmarked or shared.
  useEffect(() => {
    setSearchParams(configToParams(config), { replace: true });
  }, [config, setSearchParams]);

  const filtersJson = JSON.stringify(config.filters);
  useEffect(() => {
    if (!meta) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ fact: config.fact, rows: config.rows, filters: filtersJson });
    if (config.cols) q.set("cols", config.cols);
    api
      .get<PivotResult>(`/pivot.php?${q.toString()}`)
      .then((r) => {
        if (id === requestId.current) setResult(r);
      })
      .catch((e: unknown) => {
        if (id === requestId.current) setError(e instanceof ApiError ? e.message : "Could not run this pivot.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [meta, config.fact, config.rows, config.cols, filtersJson]);

  const factMeta = meta?.[config.fact];
  const rowsDim = factMeta?.dims.find((d) => d.key === config.rows);
  const colsDim = factMeta?.dims.find((d) => d.key === config.cols) ?? null;
  const measure = factMeta?.measures.find((m) => m.key === config.measure) ?? factMeta?.measures[0];

  const update = useCallback((patch: Partial<PivotConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setDrill(null);
    setDrillData(null);
  }, []);

  function switchFact(fact: Fact) {
    if (fact === config.fact) return;
    setResult(null);
    setDrill(null);
    setDrillData(null);
    setConfig({ ...DEFAULT_CONFIG[fact] });
  }

  function applyPreset(p: PivotConfig) {
    setResult(null);
    setDrill(null);
    setDrillData(null);
    setConfig({ ...p, filters: { ...p.filters } });
  }

  function setFilter(dim: string, values: string[]) {
    const next: Filters = { ...config.filters };
    if (values.length) next[dim] = values;
    else delete next[dim];
    update({ filters: next });
  }

  // ---- drill-through -----------------------------------------------------------
  const openDrill = useCallback(
    (r: string | null, c: string | null) => {
      if (!result) return;
      setDrill({ r, c });
      setDrillLoading(true);
      const filters: Filters = { ...config.filters };
      if (r !== null) filters[config.rows] = [r];
      if (c !== null && config.cols) filters[config.cols] = [c];
      api
        .get<DrillResult>(`/pivot.php?fact=${config.fact}&records=1&filters=${encodeURIComponent(JSON.stringify(filters))}`)
        .then(setDrillData)
        .catch(() => setDrillData(null))
        .finally(() => setDrillLoading(false));
    },
    [result, config.filters, config.rows, config.cols, config.fact],
  );

  // ---- CSV export --------------------------------------------------------------
  function exportCsv() {
    if (!result || !rowsDim || !measure) return;
    const cellLookup = new Map(result.cells.map((cell) => [`${cell.r}\u0000${cell.c}`, cell]));
    const val = (bag: Parameters<typeof measureValue>[0]) => {
      const v = measureValue(bag, measure);
      return v === null ? "" : Math.round(v * 100) / 100;
    };
    const headers = [rowsDim.label, ...(colsDim ? result.col_keys.map(formatKey) : []), "Total"];
    const rows = result.row_keys.map((r) => [
      formatKey(r),
      ...(colsDim ? result.col_keys.map((c) => val(cellLookup.get(`${r}\u0000${c}`))) : []),
      val(result.row_totals[r]),
    ]);
    rows.push(["Total", ...(colsDim ? result.col_keys.map((c) => val(result.col_totals[c])) : []), val(result.grand)]);
    downloadCsv(`pivot-${config.fact}-${config.rows}${config.cols ? `-by-${config.cols}` : ""}-${measure.key}.csv`, headers, rows);
  }

  const dimLabel = (key: string) => factMeta?.dims.find((d) => d.key === key)?.label ?? key;
  const activeFilters = Object.entries(config.filters);
  const drillTitle = useMemo(() => {
    if (!drill) return "";
    const parts: string[] = [];
    if (drill.r !== null) parts.push(`${dimLabel(config.rows)}: ${formatKey(drill.r)}`);
    if (drill.c !== null && config.cols) parts.push(`${dimLabel(config.cols)}: ${formatKey(drill.c)}`);
    return parts.length ? parts.join(" · ") : "All records in this view";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, config.rows, config.cols, factMeta]);

  const activeOnly = config.fact === "policies" && config.filters.status?.length === 1 && config.filters.status[0] === "active";

  return (
    <PortalLayout title="Pivot Explorer" navItems={adminNavItems}>
      <div className="space-y-4">
        <p className="max-w-3xl text-sm text-text-soft">
          Slice your book any way you like: pick what to count, how to group it, and click any number to see the records behind it. Insurance premium is annual;
          Mutual Fund amounts are monthly SIPs and are shown as a separate measure, never added together.
        </p>

        {/* ---- presets ------------------------------------------------------------ */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-soft">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Start from a question
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                title={p.hint}
                onClick={() => applyPreset(p.config)}
                className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-navy hover:bg-surface-2"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- controls ----------------------------------------------------------- */}
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-soft">Data</p>
              <div className="flex overflow-hidden rounded-full border border-line-strong">
                {(["policies", "leads"] as Fact[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => switchFact(f)}
                    className={`px-4 py-1.5 text-xs font-semibold ${config.fact === f ? "bg-navy text-on-navy" : "bg-surface text-text hover:bg-surface-2"}`}
                  >
                    {FACT_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            <label className="min-w-[10rem] flex-1 sm:flex-none">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-soft">Rows</span>
              <Select
                value={config.rows}
                onChange={(e) => update({ rows: e.target.value, cols: config.cols === e.target.value ? "" : config.cols })}
              >
                {factMeta?.dims.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </label>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!config.cols}
              title="Swap rows and columns"
              onClick={() => update({ rows: config.cols, cols: config.rows })}
              aria-label="Swap rows and columns"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            <label className="min-w-[10rem] flex-1 sm:flex-none">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-soft">Columns</span>
              <Select value={config.cols} onChange={(e) => update({ cols: e.target.value })}>
                <option value="">None</option>
                {factMeta?.dims
                  .filter((d) => d.key !== config.rows)
                  .map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
              </Select>
            </label>

            <label className="min-w-[12rem] flex-1 sm:flex-none">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-soft">Measure</span>
              <Select value={measure?.key ?? ""} onChange={(e) => update({ measure: e.target.value })}>
                {factMeta?.measures.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {/* filters */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-soft">
              <Filter className="h-3.5 w-3.5" aria-hidden /> Filters
            </span>
            {config.fact === "policies" && (
              <button
                type="button"
                onClick={() => setFilter("status", activeOnly ? [] : ["active"])}
                aria-pressed={activeOnly}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${activeOnly ? "border-navy bg-navy text-on-navy" : "border-line-strong bg-surface text-text-soft hover:bg-surface-2"}`}
              >
                Active policies only
              </button>
            )}
            {activeFilters
              .filter(([dim]) => !(activeOnly && dim === "status"))
              .map(([dim, values]) => (
                <span key={dim} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-xs text-text">
                  <span className="font-semibold">{dimLabel(dim)}:</span> {values.map(formatKey).join(", ")}
                  <button type="button" onClick={() => setFilter(dim, [])} className="rounded-full p-0.5 hover:bg-line" aria-label={`Remove filter ${dimLabel(dim)}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddingFilter((v) => !v)}>
              {addingFilter ? "Close" : "+ Add filter"}
            </Button>
          </div>
          {addingFilter && factMeta && (
            <FilterPicker
              fact={config.fact}
              dims={factMeta.dims}
              current={config.filters}
              onApply={(dim, values) => {
                setFilter(dim, values);
                setAddingFilter(false);
              }}
            />
          )}
        </Card>

        {/* ---- result ------------------------------------------------------------- */}
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text">
                {measure?.label} by {rowsDim?.label.toLowerCase()}
                {colsDim ? ` × ${colsDim.label.toLowerCase()}` : ""}
              </h2>
              {result && measure && (
                <p className="text-xs text-text-soft">
                  {formatMeasure(measureValue(result.grand, measure), measure)} in total · {result.truncated.row_count} {result.truncated.row_count === 1 ? "row" : "rows"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border border-line-strong">
                {(
                  [
                    ["table", "Table", Table2],
                    ["chart", "Chart", BarChart3],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update({ view: v })}
                    aria-pressed={config.view === v}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${config.view === v ? "bg-navy text-on-navy" : "bg-surface text-text hover:bg-surface-2"}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                  </button>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={exportCsv} disabled={!result || loading}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>

          {error ? (
            <EmptyState message={`Couldn't run this pivot — ${error}`} icon={BarChart3} />
          ) : !result || !rowsDim || !measure ? (
            <div className="h-64 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />
          ) : result.row_keys.length === 0 ? (
            <EmptyState message="No records match these filters." icon={Filter} />
          ) : (
            <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={loading}>
              {config.view === "table" ? (
                <PivotTable result={result} rowsDim={rowsDim} colsDim={colsDim} measure={measure} onDrill={openDrill} active={drill} />
              ) : (
                <PivotChart result={result} rowsDim={rowsDim} colsDim={colsDim} measure={measure} />
              )}
              {(result.truncated.rows || result.truncated.cols) && (
                <p className="mt-3 text-xs text-text-soft">
                  Showing the largest {result.row_keys.length} of {result.truncated.row_count} rows{result.truncated.cols ? ` and ${result.col_keys.length} of ${result.truncated.col_count} columns` : ""}.
                  Totals still include everything; add a filter to narrow it down.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ---- drill-through -------------------------------------------------------- */}
        {drill && (
          <Card className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-text">{drillTitle}</h2>
                <p className="text-xs text-text-soft">
                  {drillData ? `${drillData.total.toLocaleString("en-IN")} ${config.fact}${drillData.total > drillData.shown ? ` — showing the ${drillData.shown} ${config.fact === "policies" ? "largest premiums" : "newest"}` : ""}` : "Loading records…"}
                </p>
              </div>
              <button type="button" onClick={() => { setDrill(null); setDrillData(null); }} className="rounded-md p-1.5 text-text-soft hover:bg-surface-2" aria-label="Close records">
                <X className="h-4 w-4" />
              </button>
            </div>
            {drillLoading && !drillData ? (
              <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
            ) : !drillData || drillData.records.length === 0 ? (
              <EmptyState message="No records." icon={Filter} />
            ) : (
              <ul className="divide-y divide-line">
                {drillData.records.map((rec) => (
                  <li key={rec.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <Link to={rec.client_id ? `/admin/clients/${rec.client_id}` : "/admin/leads"} className="font-medium text-text hover:underline">
                        {rec.title}
                      </Link>
                      <p className="truncate text-xs text-text-soft">{[rec.line1, rec.line2].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      {rec.amount !== null && <span className="font-mono tabular-nums text-text">{formatINR(rec.amount)}</span>}
                      {rec.badge && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-text-soft">{formatKey(rec.badge)}</span>}
                      {rec.date && <span className="text-text-soft">{config.fact === "policies" ? "Renews " : ""}{formatDate(rec.date)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}

/** Pick one dimension, then tick the values to keep. */
function FilterPicker({
  fact,
  dims,
  current,
  onApply,
}: {
  fact: Fact;
  dims: { key: string; label: string }[];
  current: Filters;
  onApply: (dim: string, values: string[]) => void;
}) {
  const [dim, setDim] = useState(dims[0]?.key ?? "");
  const [values, setValues] = useState<{ value: string; count: number }[] | null>(null);
  const [picked, setPicked] = useState<string[]>(current[dims[0]?.key ?? ""] ?? []);

  useEffect(() => {
    let cancelled = false;
    setValues(null);
    setPicked(current[dim] ?? []);
    api
      .get<{ value: string; count: number }[]>(`/pivot.php?fact=${fact}&values=${encodeURIComponent(dim)}`)
      .then((v) => {
        if (!cancelled) setValues(v);
      })
      .catch(() => {
        if (!cancelled) setValues([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim, fact]);

  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-soft">
          Filter by
          <Select value={dim} onChange={(e) => setDim(e.target.value)} className="w-48 normal-case tracking-normal">
            {dims.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </Select>
        </label>
        <span className="text-xs text-text-soft">{picked.length ? `${picked.length} selected` : "Tick the values to keep"}</span>
      </div>
      {values === null ? (
        <div className="h-16 animate-pulse rounded bg-surface-2" />
      ) : (
        <ul className="grid max-h-48 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {values.map((v) => (
            <li key={v.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={picked.includes(v.value)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, v.value] : p.filter((x) => x !== v.value)))}
                />
                <span className="min-w-0 flex-1 truncate text-text">{formatKey(v.value)}</span>
                <span className="font-mono text-xs text-text-soft">{v.count}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => onApply(dim, picked)}>
          Apply
        </Button>
        {picked.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setPicked([])}>
            Clear ticks
          </Button>
        )}
      </div>
    </div>
  );
}
