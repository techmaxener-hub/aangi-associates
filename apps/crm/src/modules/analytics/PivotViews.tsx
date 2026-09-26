import { useMemo, type CSSProperties } from "react";
import { HBars, LegendDot, StackedBars, type BarDatum } from "../../components/charts/charts";
import { C, segmentColor, tint } from "../../components/charts/palette";
import { formatKey, formatMeasure, formatMeasureExact, measureValue } from "./pivotFormat";
import type { DimensionMeta, MeasureMeta, PivotResult } from "./types";

const cellKey = (r: string, c: string) => `${r}\u0000${c}`;

// A rate on a handful of records is noise (1 of 1 = "100%"), so charts only rank groups with at least this many.
const MIN_RATE_SAMPLE = 5;

function sampleNote(bag: Record<string, number> | undefined, m: MeasureMeta): string {
  return m.ratio && bag ? ` (${(bag[m.ratio[0]] ?? 0).toLocaleString("en-IN")} of ${(bag[m.ratio[1]] ?? 0).toLocaleString("en-IN")})` : "";
}

/** Heat-mapped pivot table. Click a cell, a row/column header or a total to drill into the records. */
export function PivotTable({
  result,
  rowsDim,
  colsDim,
  measure,
  onDrill,
  active,
}: {
  result: PivotResult;
  rowsDim: DimensionMeta;
  colsDim: DimensionMeta | null;
  measure: MeasureMeta;
  onDrill: (r: string | null, c: string | null) => void;
  active: { r: string | null; c: string | null } | null;
}) {
  const { cellMap, cellBag, max } = useMemo(() => {
    const map = new Map<string, number | null>();
    const bags = new Map<string, Record<string, number>>();
    let top = 0;
    for (const cell of result.cells) {
      const v = measureValue(cell, measure);
      map.set(cellKey(cell.r, cell.c), v);
      bags.set(cellKey(cell.r, cell.c), cell);
      if (v !== null && v > top) top = v;
    }
    return { cellMap: map, cellBag: bags, max: top };
  }, [result.cells, measure]);

  const heat = (v: number | null | undefined): CSSProperties | undefined => {
    if (v === null || v === undefined || max <= 0 || v <= 0) return undefined;
    const t = v / max;
    return { backgroundColor: `color-mix(in srgb, var(--brand-blue) ${Math.round(6 + t * 74)}%, white)`, color: t > 0.78 ? "#fff" : "var(--brand-dark-navy)" };
  };

  const hasCols = !!colsDim;
  const isActive = (r: string | null, c: string | null) => !!active && active.r === r && active.c === c;
  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-soft";

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-2">
            <th className={`${th} sticky left-0 z-10 bg-surface-2`}>{rowsDim.label}</th>
            {hasCols &&
              result.col_keys.map((c) => (
                <th key={c} className={`${th} text-right`}>
                  <button type="button" className="font-semibold uppercase hover:text-text hover:underline" onClick={() => onDrill(null, c)} title={`Show records for ${formatKey(c)}`}>
                    {formatKey(c)}
                  </button>
                </th>
              ))}
            <th className={`${th} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {result.row_keys.map((r) => {
            const total = measureValue(result.row_totals[r], measure);
            return (
              <tr key={r} className="border-t border-line">
                <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-medium text-text">
                  <button type="button" className="hover:underline" onClick={() => onDrill(r, null)} title={`Show records for ${formatKey(r)}`}>
                    {formatKey(r)}
                  </button>
                </th>
                {result.col_keys.map((c) => {
                  const v = cellMap.get(cellKey(r, c));
                  const has = cellMap.has(cellKey(r, c));
                  return (
                    <td key={c} className="p-0 text-right">
                      <button
                        type="button"
                        disabled={!has}
                        onClick={() => onDrill(r, hasCols ? c : null)}
                        title={has ? `${formatKey(r)}${hasCols ? ` · ${formatKey(c)}` : ""}: ${formatMeasureExact(v ?? null, measure)}${sampleNote(cellBag.get(cellKey(r, c)), measure)}` : "No records"}
                        className={`block w-full px-3 py-1.5 font-mono tabular-nums transition-shadow enabled:hover:shadow-[inset_0_0_0_2px_var(--brand-red)] disabled:cursor-default disabled:text-text-soft/50 ${isActive(r, hasCols ? c : null) ? "shadow-[inset_0_0_0_2px_var(--brand-red)]" : ""}`}
                        style={heat(v)}
                      >
                        {has ? formatMeasure(v ?? null, measure) : "·"}
                      </button>
                    </td>
                  );
                })}
                <td className="bg-surface-2/60 p-0 text-right">
                  <button type="button" className="block w-full px-3 py-1.5 font-mono font-semibold tabular-nums hover:bg-surface-2" onClick={() => onDrill(r, null)}>
                    {formatMeasure(total, measure)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line-strong bg-surface-2/60 font-semibold">
            <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left">Total</th>
            {hasCols &&
              result.col_keys.map((c) => (
                <td key={c} className="p-0 text-right">
                  <button type="button" className="block w-full px-3 py-2 font-mono tabular-nums hover:bg-surface-2" onClick={() => onDrill(null, c)}>
                    {formatMeasure(measureValue(result.col_totals[c], measure), measure)}
                  </button>
                </td>
              ))}
            <td className="p-0 text-right">
              <button type="button" className="block w-full px-3 py-2 font-mono tabular-nums hover:bg-surface-2" onClick={() => onDrill(null, null)}>
                {formatMeasure(measureValue(result.grand, measure), measure)}
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const PART_COLORS = [C.blue, C.red, C.navy, C.green, tint(C.blue, 55), tint(C.red, 55), tint(C.navy, 45)];

/** Bars for the current pivot: one bar per row, stacked by column when a column dimension is set. */
export function PivotChart({
  result,
  rowsDim,
  colsDim,
  measure,
}: {
  result: PivotResult;
  rowsDim: DimensionMeta;
  colsDim: DimensionMeta | null;
  measure: MeasureMeta;
}) {
  const fmt = (v: number) => formatMeasure(v, measure);
  const integer = measure.format === "int";

  // Rates can't be stacked (a stack of percentages is meaningless) — say so instead of drawing a wrong chart.
  if (colsDim && measure.ratio) {
    return (
      <p className="rounded-lg bg-surface-2 p-4 text-sm text-text-soft">
        A rate such as <strong className="text-text">{measure.label}</strong> can’t be stacked. Remove the column dimension to see it as bars, or switch to the table view to see it as a heat map.
      </p>
    );
  }

  const rowValue = (r: string) => measureValue(result.row_totals[r], measure) ?? 0;

  if (!colsDim) {
    const sampleOf = (r: string) => (measure.ratio ? (result.row_totals[r]?.[measure.ratio[1]] ?? 0) : Infinity);
    const eligible = result.row_keys.filter((r) => sampleOf(r) >= MIN_RATE_SAMPLE);
    const tooSmall = result.row_keys.length - eligible.length;
    const keys = rowsDim.time ? [...eligible] : [...eligible].sort((a, b) => rowValue(b) - rowValue(a));
    const shown = keys.slice(0, 20);
    const items = shown.map((r) => ({
      label: formatKey(r),
      value: rowValue(r),
      right: fmt(rowValue(r)),
      sub: measure.ratio ? `${(result.row_totals[r]?.[measure.ratio[0]] ?? 0).toLocaleString("en-IN")} of ${sampleOf(r).toLocaleString("en-IN")}` : undefined,
      color: C.blue,
    }));
    return (
      <div>
        <HBars items={items} />
        {tooSmall > 0 && <p className="mt-3 text-xs text-text-soft">{tooSmall} group{tooSmall === 1 ? "" : "s"} with fewer than {MIN_RATE_SAMPLE} records hidden — too few to give a meaningful rate. The table view shows them.</p>}
        {keys.length > shown.length && <p className="mt-3 text-xs text-text-soft">Showing the top {shown.length} of {keys.length}. The table view lists everything.</p>}
      </div>
    );
  }

  // Stacked: bars = rows, stack = columns (top 6 by total, the rest folded into "Other").
  const colValue = (c: string) => measureValue(result.col_totals[c], measure) ?? 0;
  const rankedCols = [...result.col_keys].sort((a, b) => colValue(b) - colValue(a));
  const topCols = colsDim.time ? result.col_keys.slice(0, 7) : rankedCols.slice(0, 6);
  const otherCols = result.col_keys.filter((c) => !topCols.includes(c));
  const cellLookup = new Map(result.cells.map((cell) => [cellKey(cell.r, cell.c), cell]));
  const colorOf = (c: string, i: number) => (colsDim.key === "segment" ? segmentColor(c) : PART_COLORS[i % PART_COLORS.length]);

  const barRows = (rowsDim.time ? result.row_keys : [...result.row_keys].sort((a, b) => rowValue(b) - rowValue(a))).slice(0, rowsDim.time ? 24 : 14);
  const data: BarDatum[] = barRows.map((r) => {
    const parts = topCols.map((c, i) => ({
      key: c,
      label: formatKey(c),
      value: measureValue(cellLookup.get(cellKey(r, c)), measure) ?? 0,
      color: colorOf(c, i),
    }));
    if (otherCols.length) {
      parts.push({
        key: "__other",
        label: "Other",
        value: otherCols.reduce((a, c) => a + (measureValue(cellLookup.get(cellKey(r, c)), measure) ?? 0), 0),
        color: tint(C.navy, 30),
      });
    }
    return { label: formatKey(r).replace(/ 20(\d\d)$/, " ’$1"), parts };
  });

  return (
    <div>
      <StackedBars data={data} height={300} format={fmt} integer={integer} ariaLabel={`${measure.label} by ${rowsDim.label}, stacked by ${colsDim.label}`} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-soft">
        {topCols.map((c, i) => (
          <LegendDot key={c} color={colorOf(c, i)} label={formatKey(c)} />
        ))}
        {otherCols.length > 0 && <LegendDot color={tint(C.navy, 30)} label={`Other (${otherCols.length})`} />}
      </div>
      {result.row_keys.length > barRows.length && <p className="mt-2 text-xs text-text-soft">Showing {barRows.length} of {result.row_keys.length} rows. The table view lists everything.</p>}
    </div>
  );
}

