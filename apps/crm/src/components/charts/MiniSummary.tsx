import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { SegmentBar } from "./charts";

export interface SummaryPart {
  label: string;
  value: number;
  color: string;
}

/**
 * A compact "where does everything stand" card for list/board pages: title,
 * total, one animated segmented bar with per-segment counts. Sits above the
 * page's own list so the picture comes before the detail.
 */
export function MiniSummary({
  title,
  total,
  parts,
  aside,
  className = "",
}: {
  title: string;
  total: number;
  parts: SummaryPart[];
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-text">
          {title} <span className="ml-1 font-mono text-sm font-normal text-text-soft">· {total.toLocaleString("en-IN")}</span>
        </h2>
        {aside}
      </div>
      <SegmentBar parts={parts} />
    </Card>
  );
}
