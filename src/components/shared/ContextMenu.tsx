import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ContextMenu as ContextMenuRoot,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

export interface ContextMenuEntry {
  label: string;
  icon?: LucideIcon;
  swatch?: {
    color: string;
    selected?: boolean;
  };
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  separatorAfter?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuEntry[];
  children: ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  return (
    <ContextMenuRoot>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {items.map((item) => (
          <div key={item.label}>
            <ContextMenuItem
              onSelect={item.onSelect}
              disabled={item.disabled}
              className={cn(
                item.danger && "text-destructive focus:text-destructive",
              )}
            >
              {item.icon && <item.icon className="mr-2 size-3.5" aria-hidden />}
              {item.swatch && (
                <span
                  className={cn(
                    "mr-2 size-3.5 shrink-0 rounded-full ring-1 ring-inset ring-white/20",
                    item.swatch.selected &&
                      "ring-2 ring-foreground ring-offset-1 ring-offset-popover",
                  )}
                  style={{ backgroundColor: item.swatch.color }}
                  aria-hidden
                />
              )}
              {item.label}
              {item.shortcut && (
                <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>
              )}
            </ContextMenuItem>
            {item.separatorAfter && <ContextMenuSeparator />}
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}
