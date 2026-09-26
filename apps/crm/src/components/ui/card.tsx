import * as React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  // Opt-in, not the default — a lift-on-hover reads as "this is clickable"
  // and would be misleading on plain content/form cards. Pass true only on
  // cards that are themselves a link/button or sit in a scannable grid.
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, interactive = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-line bg-surface p-6 shadow-card",
      interactive && "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-raised",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";
