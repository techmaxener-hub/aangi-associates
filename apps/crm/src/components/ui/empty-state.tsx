import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({
  message,
  icon: Icon = Inbox,
  action,
}: {
  message: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <Icon className="h-5 w-5 text-text-soft" />
      <p className="text-sm text-text-soft">{message}</p>
      {action}
    </div>
  );
}
