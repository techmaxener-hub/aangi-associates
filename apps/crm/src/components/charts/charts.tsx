import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "../ui/card";
import { C, tint } from "./palette";
import { niceScale } from "./scale";
import { useAnimateIn, useContainerWidth, useCountUp } from "./useChartAnim";

// Dependency-free SVG/CSS charts. Every chart: animates in once (skipped under
// prefers-reduced-motion), has a text alternative (aria-label / visible values),
// scales with its container (viewBox), and takes colours from palette.ts only.

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const n = useCountUp(value);
  return <>{format ? format(n) : Math.round(n).toLocaleString("en-IN")}</>;
}

// ---------------------------------------------------------------------------
// Card wrapper with a consistent header

export function ChartCard({
  title,
  subtitle,
  href,
  hrefLabel,
  legend,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`relative overflow-hidden p-5 ${className}`} interactive>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight text-text">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-text-soft">{subtitle}</p>}
        </div>
        {href && (
          <Link to={href} className="shrink-0 text-xs font-semibold text-gold-text hover:underline">
            {hrefLabel ?? "Open"} →
          </Link>
        )}
      </div>
      {children}
      {legend && <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-soft">{legend}</div>}
    </Card>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/** ▲/▼ chip. `goodWhen` says which direction is good news (claims going up is not). */
export function DeltaChip({ pct, goodWhen = "up" }: { pct: number | null; goodWhen?: "up" | "down" }) {
  if (pct === null) {
    return <span className="text-[11px] text-text-soft">no prior period</span>;
  }
  const up = pct > 0;
  const flat = Math.abs(pct) < 0.05;
  const good = flat ? null : up === (goodWhen === "up");
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = good === null ? C.navy : good ? C.green : C.red;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, white)` }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {flat ? "flat" : `${up ? "+" : ""}${pct.toFixed(1)}%`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sparkline

export function Sparkline({ values, color = C.blue, height = 34 }: { values: number[]; color?: string; height?: number }) {
  const gid = useId();
  const ready = useAnimateIn();
  const w = 100;
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, height - 3 - ((v - min) / span) * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.32 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} style={{ opacity: ready ? 1 : 0, transition: "opacity 0.8s ease 0.3s" }} />
      <path
        d={line}
        fill="none"
        pathLength={1}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: color, strokeDasharray: 1, strokeDashoffset: ready ? 0 : 1, transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Smooth area/line chart with hover tooltip

function smoothPath(pts: [number, number][], min: number, max: number): string {
  const clamp = (y: number) => Math.min(max, Math.max(min, y));
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export interface AreaSeries {
  name: string;
  color: string;
  values: number[];
  fill?: boolean;
}

export function AreaChart({
  labels,
  series,
  height = 230,
  ariaLabel,
}: {
  labels: string[];
  series: AreaSeries[];
  height?: number;
  ariaLabel: string;
}) {
  const uid = useId();
  const ready = useAnimateIn();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, measured] = useContainerWidth<HTMLDivElement>();
  const W = Math.max(260, measured || 640);
  const H = height;
  const pad = { l: 34, r: 12, t: 14, b: 26 };
  const n = labels.length;
  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
  const yMax = niceScale(rawMax).max;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const grid = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  const labelEvery = n > 8 ? (W < 460 ? 3 : 2) : 1;

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.name} id={`${uid}-g${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: s.color, stopOpacity: si === 0 ? 0.34 : 0.2 }} />
              <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
            </linearGradient>
          ))}
        </defs>
        {grid.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} style={{ stroke: "var(--line)" }} strokeDasharray={g === 0 ? undefined : "3 4"} />
            <text x={pad.l - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" style={{ fill: "var(--text-soft)" }}>
              {Math.round(g)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          (i % labelEvery === 0 && n - 1 - i >= labelEvery) || i === n - 1 ? (
            <text key={l + i} x={x(i)} y={H - 7} textAnchor={i === n - 1 ? "end" : "middle"} fontSize="10" style={{ fill: "var(--text-soft)" }}>
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          const line = smoothPath(pts, pad.t, H - pad.b);
          const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
          return (
            <g key={s.name}>
              {s.fill !== false && (
                <path d={area} fill={`url(#${uid}-g${si})`} style={{ opacity: ready ? 1 : 0, transition: "opacity 0.9s ease 0.35s" }} />
              )}
              <path
                d={line}
                fill="none"
                pathLength={1}
                strokeWidth={si === 0 ? 2.6 : 2}
                strokeLinecap="round"
                style={{ stroke: s.color, strokeDasharray: 1, strokeDashoffset: ready ? 0 : 1, transition: `stroke-dashoffset 1.1s ease ${si * 0.15}s` }}
              />
            </g>
          );
        })}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} style={{ stroke: "var(--line-strong)" }} strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} strokeWidth={2.5} style={{ fill: "white", stroke: s.color }} />
            ))}
          </g>
        )}
        {labels.map((l, i) => (
          <rect
            key={`hit-${l}-${i}`}
            x={x(i) - (W - pad.l - pad.r) / Math.max(1, n - 1) / 2}
            y={pad.t}
            width={(W - pad.l - pad.r) / Math.max(1, n - 1)}
            height={H - pad.t - pad.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-raised"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="mb-0.5 font-semibold text-text">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1.5 text-text-soft">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}: <span className="font-mono font-semibold text-text">{s.values[hover]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  sub?: string;
}

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 176,
  thickness = 5.2,
  ariaLabel,
  formatValue,
  layout = "row",
}: {
  slices: DonutSlice[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  ariaLabel: string;
  formatValue?: (v: number) => string;
  /** "stack" puts the legend under the donut — use it in narrow cards. */
  layout?: "row" | "stack";
}) {
  const ready = useAnimateIn();
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const GAP = slices.length > 1 ? 0.7 : 0;
  const lens = slices.map((s) => (s.value / total) * 100);
  const arcs = lens.map((len, i) => ({ start: lens.slice(0, i).reduce((x, y) => x + y, 0), len }));
  const a = active !== null ? slices[active] : null;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN"));

  return (
    <div className={layout === "stack" ? "flex flex-col items-center gap-5" : "flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6"}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={ariaLabel} className="-rotate-90">
          <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth={thickness} style={{ stroke: "var(--surface-2)" }} />
          {slices.map((s, i) => {
            const shown = Math.max(0, arcs[i].len - GAP);
            return (
              <circle
                key={s.label}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                pathLength={100}
                strokeWidth={active === i ? thickness + 1.6 : thickness}
                strokeLinecap="butt"
                style={{
                  stroke: s.color,
                  strokeDasharray: ready ? `${shown} ${100 - shown}` : "0 100",
                  strokeDashoffset: -arcs[i].start,
                  transition: "stroke-dasharray 0.9s cubic-bezier(.2,.8,.2,1), stroke-width 0.15s ease",
                  opacity: active === null || active === i ? 1 : 0.35,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-mono text-2xl font-semibold tabular-nums leading-none text-text">{a ? fmt(a.value) : centerValue}</p>
          <p className="mt-1 max-w-[6.5rem] text-[11px] leading-tight text-text-soft">{a ? `${a.label} · ${Math.round((a.value / total) * 100)}%` : centerLabel}</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 self-stretch text-sm">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className="flex cursor-default items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-text">{s.label}</span>
            <span className="text-right">
              <span className="block font-mono text-sm font-semibold tabular-nums text-text">{fmt(s.value)}</span>
              {s.sub && <span className="block text-[11px] text-text-soft">{s.sub}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked / single-series vertical bars

export interface BarPart {
  key: string;
  label: string;
  value: number;
  color: string;
}
export interface BarDatum {
  label: string;
  parts: BarPart[];
  /** extra tooltip lines, e.g. money for the bar */
  extra?: string[];
  highlight?: boolean;
}

export function StackedBars({
  data,
  height = 230,
  ariaLabel,
  format,
  integer = true,
}: {
  data: BarDatum[];
  height?: number;
  ariaLabel: string;
  /** formats axis, totals and tooltip values (e.g. compact ₹) — defaults to plain numbers */
  format?: (n: number) => string;
  /** false for money/percent so axis steps may be fractional */
  integer?: boolean;
}) {
  const fmt = format ?? ((v: number) => String(Math.round(v)));
  const ready = useAnimateIn();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, measured] = useContainerWidth<HTMLDivElement>();
  const W = Math.max(260, measured || 640);
  const H = height;
  const pad = { l: 34, r: 8, t: 14, b: 26 };
  const totals = data.map((d) => d.parts.reduce((a, p) => a + p.value, 0));
  const rawMax = Math.max(1, ...totals);
  const yMax = niceScale(rawMax, integer).max;
  const slot = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(46, slot * 0.58);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const grid = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} style={{ stroke: "var(--line)" }} strokeDasharray={g === 0 ? undefined : "3 4"} />
            <text x={pad.l - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" style={{ fill: "var(--text-soft)" }}>
              {fmt(g)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          let base = 0;
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.label} style={{ opacity: dim ? 0.45 : 1, transition: "opacity 0.15s" }}>
              {d.parts.map((p, pi) => {
                const top = y(base + p.value);
                const bottom = y(base);
                base += p.value;
                const isTopPart = pi === d.parts.length - 1 || d.parts.slice(pi + 1).every((q) => q.value === 0);
                const h = Math.max(0, bottom - top);
                return (
                  <rect
                    key={p.key}
                    x={cx - bw / 2}
                    width={bw}
                    rx={isTopPart ? 5 : 0}
                    y={ready ? top : bottom}
                    height={ready ? h : 0}
                    style={{ fill: p.color, transition: `y 0.8s cubic-bezier(.2,.8,.2,1) ${i * 0.06}s, height 0.8s cubic-bezier(.2,.8,.2,1) ${i * 0.06}s` }}
                  />
                );
              })}
              {d.highlight && <rect x={cx - bw / 2 - 3} y={pad.t - 4} width={bw + 6} height={H - pad.t - pad.b + 4} rx={8} fill="none" strokeWidth={1.5} strokeDasharray="4 4" style={{ stroke: C.red }} />}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="10.5" style={{ fill: "var(--text-soft)" }}>
                {d.label}
              </text>
              <text x={cx} y={y(totals[i]) - 5} textAnchor="middle" fontSize="10" fontWeight={600} style={{ fill: "var(--text)", opacity: ready ? 1 : 0, transition: "opacity 0.6s ease 0.6s" }}>
                {totals[i] ? fmt(totals[i]) : ""}
              </text>
              <rect x={cx - slot / 2} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-raised"
          style={{ left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%` }}
        >
          <p className="mb-0.5 font-semibold text-text">
            {data[hover].label} · {fmt(totals[hover])}
          </p>
          {data[hover].parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <p key={p.key} className="flex items-center gap-1.5 text-text-soft">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label}: <span className="font-mono font-semibold text-text">{fmt(p.value)}</span>
              </p>
            ))}
          {data[hover].extra?.map((e) => (
            <p key={e} className="text-text-soft">
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars (sources, leaderboards)

export interface HBarItem {
  label: string;
  value: number;
  color?: string;
  right?: string; // text on the right, defaults to the value
  sub?: string;
  href?: string;
  icon?: ReactNode;
}

export function HBars({ items, max, color = C.blue }: { items: HBarItem[]; max?: number; color?: string }) {
  const ready = useAnimateIn();
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it, idx) => {
        const body = (
          <div className="flex items-center gap-3">
            {it.icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tint(it.color ?? color, 14), color: it.color ?? color }}>
                {it.icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm text-text">{it.label}</p>
                <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-text">{it.right ?? it.value.toLocaleString("en-IN")}</p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: ready ? `${Math.max(2, (it.value / top) * 100)}%` : "0%",
                    background: `linear-gradient(90deg, ${tint(it.color ?? color, 55)}, ${it.color ?? color})`,
                    transition: `width 0.9s cubic-bezier(.2,.8,.2,1) ${idx * 0.06}s`,
                  }}
                />
              </div>
              {it.sub && <p className="mt-0.5 text-[11px] text-text-soft">{it.sub}</p>}
            </div>
          </div>
        );
        return (
          <li key={it.label}>
            {it.href ? (
              <Link to={it.href} className="block rounded-md hover:bg-surface-2">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Funnel (cumulative stages)

export interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

export function FunnelChart({ stages, ariaLabel }: { stages: FunnelStage[]; ariaLabel: string }) {
  const ready = useAnimateIn();
  const top = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div role="img" aria-label={ariaLabel} className="space-y-1.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const step = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : null;
        return (
          <div key={s.label}>
            {step !== null && (
              <div className="flex items-center justify-center gap-1 py-0.5 text-[11px] text-text-soft">
                <ArrowDownRight className="h-3 w-3" aria-hidden />
                {step}% continue
              </div>
            )}
            <div className="flex justify-center">
              <div
                className="flex h-12 items-center justify-between gap-3 rounded-lg px-4 text-sm font-semibold text-white shadow-card"
                style={{
                  width: ready ? `${55 + 45 * (s.value / top)}%` : "0%",
                  background: `linear-gradient(90deg, ${s.color}, color-mix(in srgb, ${s.color} 78%, white))`,
                  transition: `width 0.9s cubic-bezier(.2,.8,.2,1) ${i * 0.1}s`,
                  minWidth: ready ? undefined : 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{s.label}</span>
                <span className="font-mono tabular-nums">{s.value.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radial gauge

export function RadialGauge({
  pct,
  label,
  sub,
  color = C.blue,
  ariaLabel,
}: {
  pct: number;
  label: string;
  sub?: string;
  color?: string;
  ariaLabel: string;
}) {
  const uid = useId();
  const ready = useAnimateIn();
  const shown = Math.max(0, Math.min(100, pct));
  const over = pct >= 100;
  const arcColor = over ? C.green : color;
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 100 62" className="block w-full" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: tint(arcColor, 45) }} />
            <stop offset="100%" style={{ stopColor: arcColor }} />
          </linearGradient>
        </defs>
        <path d="M10,52 A40,40 0 0 1 90,52" fill="none" strokeWidth={9} strokeLinecap="round" style={{ stroke: "var(--surface-2)" }} />
        <path
          d="M10,52 A40,40 0 0 1 90,52"
          fill="none"
          pathLength={100}
          strokeWidth={9}
          strokeLinecap="round"
          stroke={`url(#${uid})`}
          style={{ strokeDasharray: `${ready ? shown : 0} 100`, transition: "stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1)" }}
        />
        {[0, 25, 50, 75, 100].map((t) => {
          const ang = Math.PI * (1 - t / 100);
          return (
            <line
              key={t}
              x1={50 + 46.5 * Math.cos(ang)}
              y1={52 - 46.5 * Math.sin(ang)}
              x2={50 + 49 * Math.cos(ang)}
              y2={52 - 49 * Math.sin(ang)}
              strokeWidth={0.8}
              style={{ stroke: "var(--line-strong)" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-mono text-3xl font-semibold tabular-nums leading-none" style={{ color: arcColor }}>
          <CountUp value={pct} format={(n) => `${Math.round(n)}%`} />
        </p>
        <p className="mt-1 text-xs font-semibold text-text">{label}</p>
        {sub && <p className="text-[11px] text-text-soft">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented horizontal bar (claims stages, task status)

export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const ready = useAnimateIn();
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.map((p, i) => (
          <div
            key={p.label}
            title={`${p.label}: ${p.value}`}
            style={{
              width: ready && total ? `${(p.value / total) * 100}%` : "0%",
              backgroundColor: p.color,
              transition: `width 0.9s cubic-bezier(.2,.8,.2,1) ${i * 0.1}s`,
              marginRight: i < parts.length - 1 && p.value ? 2 : 0,
            }}
          />
        ))}
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-2 ${parts.length === 3 ? "sm:grid-cols-3" : parts.length >= 5 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        {parts.map((p) => (
          <div key={p.label}>
            <p className="font-mono text-xl font-semibold tabular-nums text-text">{p.value}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-text-soft">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
