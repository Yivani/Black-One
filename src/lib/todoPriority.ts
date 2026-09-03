import type { TodoPriority } from "@/lib/todoCore";

interface PriorityMeta {
  label: string;
  /** Swatch class for the lane header and the sidebar queue dot. */
  dot: string;
  text: string;
  /** Drop-target tint used while a card hovers over a lane. */
  surface: string;
}

/**
 * How each priority reads on screen.
 *
 * Shared by the board and the sidebar queue so a Critical dot means the same
 * thing in both places. It lives outside the view because the sidebar is
 * always mounted while the board is lazy-loaded; importing it from the view
 * would pull the whole board into the startup bundle.
 */
export const PRIORITY_META: Record<TodoPriority, PriorityMeta> = {
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    surface: "bg-red-500/8",
  },
  high: {
    label: "High",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    surface: "bg-orange-500/8",
  },
  mid: {
    label: "Mid",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    surface: "bg-amber-500/8",
  },
  low: {
    label: "Low",
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-400",
    surface: "bg-slate-500/8",
  },
};
