import { useEffect, useRef } from "react";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { SAVE_HIGHLIGHT_MS, useMemoryStore } from "@/stores/memoryStore";
import { useUiStore } from "@/stores/uiStore";

/**
 * Raises a toast the moment a fact is written.
 *
 * Automatic memory is only trustworthy if it is visible: the user should never
 * discover weeks later that the app has been keeping notes. Mounted once at the
 * app root so it fires whether or not the memory UI is open.
 */
export function useMemorySaveToasts(): void {
  const { t } = useTranslation();
  const recentSaves = useMemoryStore((s) => s.recentSaves);
  const announced = useRef(new Set<string>());

  useEffect(() => {
    for (const event of recentSaves) {
      // `lastSeenAt` changes on every confirmation, so it keys one toast per
      // actual write rather than one per entry for all time.
      const key = `${event.entry.id}:${event.entry.lastSeenAt ?? 0}`;
      if (announced.current.has(key)) continue;
      announced.current.add(key);
      toast.success(
        event.outcome === "updated" ? t("memory.updated") : t("memory.saved"),
        {
          description: event.entry.content,
          action: {
            label: t("memory.openBank"),
            onClick: () => useUiStore.getState().openSettings("memory"),
          },
        },
      );
    }
    // Bound the set so a long session cannot grow it without limit.
    if (announced.current.size > 200) announced.current.clear();
  }, [recentSaves, t]);
}

/**
 * Sidebar button that shows the bank and flags newly written facts.
 *
 * The count is the app answering "did you save that?" without being asked.
 */
export function MemoryIndicator({ collapsed }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const recentSaves = useMemoryStore((s) => s.recentSaves);
  const lastSavedAt = useMemoryStore((s) => s.lastSavedAt);
  const openSettings = useUiStore((s) => s.openSettings);

  // The pulse is a moment, not a state: it fades on its own.
  const pulsing =
    lastSavedAt !== null && Date.now() - lastSavedAt < SAVE_HIGHLIGHT_MS;
  const count = recentSaves.length;
  const label = count > 0 ? t("memory.newCount", { count }) : t("memory.title");

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => openSettings("memory")}
            className="relative size-8"
          >
            <Brain className={cn("size-4", pulsing && "text-primary")} aria-hidden />
            {count > 0 && (
              <span
                className={cn(
                  "absolute right-1 top-1 size-1.5 rounded-full bg-primary",
                  pulsing && "animate-pulse",
                )}
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={() => openSettings("memory")}
      className="w-full justify-start gap-2"
    >
      <Brain className={cn("size-4 shrink-0", pulsing && "text-primary")} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{t("memory.title")}</span>
      {count > 0 && (
        <span
          className={cn(
            "shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] leading-none text-primary-foreground",
            pulsing && "animate-pulse",
          )}
        >
          {count}
        </span>
      )}
    </Button>
  );
}
