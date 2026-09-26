import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-soft transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:border-crimson disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
