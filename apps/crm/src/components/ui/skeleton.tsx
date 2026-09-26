import { cn } from "../../lib/utils";

// A subtle gold-tinted shimmer sweep instead of a flat gray pulse — small
// difference, but it means even the "still loading" moment reads as this
// app's brand rather than a generic template default.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer relative overflow-hidden rounded-md bg-surface-2", className)} />;
}

// Mirrors the row/column shape of the striped tables used across list
// pages, so the loading state doesn't jump when real rows arrive.
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className={r > 0 ? "border-t border-line" : undefined}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-[10rem]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// For card-list pages (a stack of Card rows) rather than a <table>.
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="rounded-lg border border-line bg-surface p-4">
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// For a client/candidate detail page: an info-grid row, a tab bar, and a
// content block — the shape shared by every detail page in the app.
export function DetailSkeleton({ infoItems = 4 }: { infoItems?: number }) {
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: infoItems }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-4 h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// For the Admin Dashboard: a KPI row plus a grid of panel cards, the one
// layout shape that's actually distinctive enough to be worth its own
// skeleton rather than reusing DetailSkeleton or ListSkeleton.
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-5">
            <Skeleton className="mb-4 h-4 w-32" />
            <Skeleton className="mb-2.5 h-3 w-full" />
            <Skeleton className="mb-2.5 h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// For kanban-style pipeline boards (Leads Desk, Tasks) — a column header
// bar plus a couple of card placeholders per column.
// Column counts are literal Tailwind classes (not built from the `columns`
// prop) so the responsive variants survive Tailwind's JIT scan — an inline
// gridTemplateColumns style can't carry a breakpoint, which left this
// skeleton forcing 3-4 equal columns on a phone right before the real,
// properly-responsive board (LeadsDeskPage/TasksPage) loaded in at 1 column.
const BOARD_COLS_CLASS: Record<number, string> = {
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function BoardSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div className={`grid gap-4 ${BOARD_COLS_CLASS[columns] ?? "grid-cols-1 sm:grid-cols-3"}`}>
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c}>
          <Skeleton className="mb-3 h-3 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
