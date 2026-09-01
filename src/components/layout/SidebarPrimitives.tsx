import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Shared sidebar rhythm. Every section has the same header shape and every row
 * the same height, so the panel reads as one list of groups rather than a
 * stack of differently-styled blocks.
 */

/** One row height for workspaces, terminals, and tasks alike. */
export const SIDEBAR_ROW =
  "group relative flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-standard focus-visible:ring-2 focus-visible:ring-ring";

export const SIDEBAR_ROW_ACTIVE = "bg-accent text-accent-foreground";
export const SIDEBAR_ROW_IDLE = "hover:bg-accent/50";

/** Trailing control that only appears on hover or keyboard focus. */
export const SIDEBAR_ROW_REVEAL =
  "shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100";

interface SidebarSectionProps {
  id: string;
  label: string;
  count?: number;
  /** Buttons rendered at the end of the header row. */
  actions?: ReactNode;
  children: ReactNode;
  /** The first section matches the content header's height so panels line up. */
  lead?: boolean;
  className?: string;
}

export function SidebarSection({
  id,
  label,
  count,
  actions,
  children,
  lead = false,
  className,
}: SidebarSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn("border-b border-border", className)}
    >
      <div
        className={cn(
          "flex items-center gap-1 pl-3 pr-1.5",
          lead ? "h-11" : "h-8",
        )}
      >
        <h2
          id={id}
          className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
        >
          {label}
        </h2>
        {count !== undefined && (
          <span className="shrink-0 px-1 text-[11px] tabular-nums text-muted-foreground/70">
            {count}
          </span>
        )}
        {actions}
      </div>
      <div className="space-y-px px-1.5 pb-1.5">{children}</div>
    </section>
  );
}

interface SidebarIconActionProps {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  /** Set when the button opens a menu and should not carry its own tooltip. */
  asChild?: boolean;
}

export function SidebarIconAction({
  label,
  onClick,
  children,
}: SidebarIconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Muted single-line placeholder used when a section has nothing to list. */
export function SidebarEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="flex h-8 items-center px-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}
