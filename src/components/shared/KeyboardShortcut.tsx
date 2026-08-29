import { cn } from "@/lib/utils";

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);

const KEY_LABELS: Record<string, string> = {
  Mod: IS_MAC ? "⌘" : "Ctrl",
  Shift: IS_MAC ? "⇧" : "Shift",
  Alt: IS_MAC ? "⌥" : "Alt",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  Escape: "Esc",
  Space: "Space",
};

interface KeyboardShortcutProps {
  binding: string;
  className?: string;
}

export function KeyboardShortcut({ binding, className }: KeyboardShortcutProps) {
  const parts = binding.split("+").filter(Boolean);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={binding}>
      {parts.map((part, index) => (
        <kbd
          key={`${part}-${index}`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground"
        >
          {KEY_LABELS[part] ?? part}
        </kbd>
      ))}
    </span>
  );
}
