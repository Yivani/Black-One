import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-32 flex-col items-start justify-center gap-2 px-4 py-6 text-left",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      {description && (
        <p className="max-w-72 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
