import { useId, useState } from "react";
import { LegendDot } from "./charts";
import { C } from "./palette";
import { niceScale } from "./scale";
import { useAnimateIn, useContainerWidth } from "./useChartAnim";

// ---------------------------------------------------------------------------
// Radar (percentile profile against the team-median ring)

export interface RadarSeries {
  name: string;
  color: string;
  /** 0-100 per axis; null = not enough data (drawn at the median with a hollow dot) */
  values: (number | null)[];
}

export function RadarChart({ axes, series, ariaLabel }: { axes: string[]; series: RadarSeries[]; ariaLabel: string }) {
  const ready = useAnimateIn();
  const W = 380;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const R = 100;
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, v: number) => [cx + Math.cos(angle(i)) * R * (v / 100), cy + Math.sin(angle(i)) * R * (v / 100)] as const;
  const ring = (v: number) => axes.map((_, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[380px]" role="img" aria-label={ariaLabel}>
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" strokeWidth={v === 50 ? 1.4 : 1} strokeDasharray={v === 50 ? "4 3" : undefined} style={{ stroke: v === 50 ? "var(--text-soft)" : "var(--line)" }} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} style={{ stroke: "var(--line)" }} />;
      })}
      <text x={cx + 3} y={cy - R * 0.5 - 3} fontSize="8.5" style={{ fill: "var(--text-soft)" }}>
        team median
      </text>
      {series.map((s) => {
        const pts = s.values.map((v, i) => pt(i, v ?? 50));
        const poly = pts.map((p) => p.map((x) => x.toFixed(1)).join(",")).join(" ");
        return (
          <g
            key={s.name}
            style={{ opacity: ready ? 1 : 0, transform: ready ? "none" : "scale(0.6)", transformOrigin: `${cx}px ${cy}px`, transition: "opacity 0.6s ease, transform 0.8s cubic-bezier(.2,.8,.2,1)" }}
          >
            <polygon points={poly} strokeWidth={2.2} strokeLinejoin="round" style={{ fill: s.color, fillOpacity: 0.18, stroke: s.color }} />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3.6} strokeWidth={2} style={{ fill: s.values[i] === null ? "white" : s.color, stroke: s.color }}>
                <title>{`${axes[i]}: ${s.values[i] === null ? "not enough data" : `${Math.round(s.values[i] as number)}th percentile`}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {axes.map((label, i) => {
        const a = angle(i);
        const x = cx + Math.cos(a) * (R + 14);
        const y = cy + Math.sin(a) * (R + 14);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return (
          <text key={label} x={x} y={y + (Math.sin(a) > 0.5 ? 9 : Math.sin(a) < -0.5 ? -2 : 3)} textAnchor={anchor} fontSize="10.5" fontWeight={600} style={{ fill: "var(--text)" }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Forecast: cumulative actual vs straight-line target, with a run-rate projection

export function ForecastChart({
  totalDays,
  daily,
  expected,
  projected,
  format,
  startLabel,
  endLabel,
  ariaLabel,
}: {
  totalDays: number;
  daily: number[];
  expected: number;
  projected: number | null;
  format: (n: number) => string;
  startLabel: string;
  endLabel: string;
  ariaLabel: string;
}) {
  const uid = useId();
  const ready = useAnimateIn();
  const [wrapRef, measured] = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState(false);
  const W = Math.max(260, measured || 520);
  const H = 220;
  const pad = { l: 50, r: 14, t: 18, b: 26 };
  const last = daily.length - 1;
  const achieved = daily[last] ?? 0;
  const yMax = niceScale(Math.max(expected, projected ?? 0, achieved), false).max;
  const x = (i: number) => pad.l + (i / Math.max(1, totalDays - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const grid = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);
  const line = daily.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(last).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const projColor = projected !== null && projected >= expected ? C.green : C.red;

  return (
    <div ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={ariaLabel} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <defs>
          <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: C.blue, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: C.blue, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {grid.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} style={{ stroke: "var(--line)" }} strokeDasharray={g === 0 ? undefined : "3 4"} />
            <text x={pad.l - 6} y={y(g) + 3.5} textAnchor="end" fontSize="10" style={{ fill: "var(--text-soft)" }}>
              {format(g)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 7} fontSize="10" style={{ fill: "var(--text-soft)" }}>
          {startLabel}
        </text>
        <text x={W - pad.r} y={H - 7} textAnchor="end" fontSize="10" style={{ fill: "var(--text-soft)" }}>
          {endLabel}
        </text>
        <line x1={x(0)} y1={y(0)} x2={x(totalDays - 1)} y2={y(expected)} strokeWidth={1.6} strokeDasharray="5 4" style={{ stroke: "var(--text-soft)" }} />
        <circle cx={x(totalDays - 1)} cy={y(expected)} r={4} style={{ fill: "var(--text-soft)" }} />
        <text x={x(totalDays - 1) - 6} y={y(expected) - 8} textAnchor="end" fontSize="10" fontWeight={600} style={{ fill: "var(--text)" }}>
          Target {format(expected)}
        </text>
        {daily.length > 0 && (
          <>
            <path d={area} fill={`url(#${uid}-a)`} style={{ opacity: ready ? 1 : 0, transition: "opacity 0.8s ease 0.3s" }} />
            <path
              d={line}
              fill="none"
              pathLength={1}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: C.blue, strokeDasharray: 1, strokeDashoffset: ready ? 0 : 1, transition: "stroke-dashoffset 1s ease" }}
            />
            <circle cx={x(last)} cy={y(achieved)} r={4.5} strokeWidth={2.5} style={{ fill: "white", stroke: C.blue }} />
            {hover && (
              <text x={x(last)} y={y(achieved) - 10} textAnchor="middle" fontSize="10" fontWeight={600} style={{ fill: C.blue }}>
                {format(achieved)}
              </text>
            )}
          </>
        )}
        {projected !== null && daily.length > 0 && (
          <>
            <line
              x1={x(last)}
              y1={y(achieved)}
              x2={x(totalDays - 1)}
              y2={y(projected)}
              strokeWidth={2.2}
              strokeDasharray="2 5"
              strokeLinecap="round"
              style={{ stroke: projColor, opacity: ready ? 1 : 0, transition: "opacity 0.6s ease 0.9s" }}
            />
            <circle cx={x(totalDays - 1)} cy={y(projected)} r={4.5} style={{ fill: projColor }} />
          </>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-soft">
        <LegendDot color={C.blue} label="Achieved so far" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--text-soft)" }} /> Straight-line target
        </span>
        {projected !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dotted" style={{ borderColor: projColor }} /> Run-rate projection ({format(projected)})
          </span>
        )}
      </div>
    </div>
  );
}
