import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettingsStore } from "@/stores/settingsStore";

interface ContextBannerProps {
  count: string;
}

export function ContextBanner({ count }: ContextBannerProps) {
  const limit = useSettingsStore((s) => s.settings.memory.contextWindowLimit);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="About context truncation" className="shrink-0">
            <Info className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Older messages are omitted — Black One sends at most {limit} messages as context.
        </TooltipContent>
      </Tooltip>
      <span>Using last {count} messages for context</span>
    </div>
  );
}
