import { useModels } from "@/hooks/useModels";

const DOT_DELAYS = ["0ms", "150ms", "300ms"];

export function TypingIndicator() {
  const { selected } = useModels();
  const name = selected?.model.name ?? "Black One";

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <span className="flex items-center gap-1" aria-hidden>
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground/60"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{name} is thinking…</span>
    </div>
  );
}
