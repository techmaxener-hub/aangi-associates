import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type BadgeVariant = "neutral" | "success" | "warning" | "critical";

// One pill treatment for every status display in the app (policy status,
// integration connection state, call intent score, ...) instead of each
// screen inventing its own padding/border/color map. The 4 variants are
// semantic, not literal brand colors — pick by what the state means
// (settled/good, needs attention, urgent/bad, or just informational).
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "text-text-soft border-line-strong",
  success: "text-success border-success/40",
  warning: "text-gold-text border-gold/40",
  critical: "text-crimson border-crimson/40",
};

export function Badge({
  variant = "neutral",
  dot = true,
  className,
  children,
}: {
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-surface-2 px-2.5 py-1 text-xs font-semibold capitalize",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "currentColor" }} />}
      {children}
    </span>
  );
}
