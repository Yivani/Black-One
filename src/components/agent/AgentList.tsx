import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import { AGENT_PRESETS, createAgentSession } from "@/lib/agentPresets";
import type { AgentPreset } from "@/types/agent";

interface AgentListProps {
  className?: string;
}

function AgentPresetRow({
  preset,
  active,
  onClick,
}: {
  preset: AgentPreset;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = preset.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-standard",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{preset.name}</span>
        <span className="line-clamp-1 text-[10px] opacity-80">{preset.description}</span>
      </div>
    </button>
  );
}

export function AgentList({ className }: AgentListProps) {
  const selectedId = useUiStore((s) => s.selectedAgentPresetId);
  const setSelectedId = useUiStore((s) => s.setSelectedAgentPresetId);

  const handleSelect = async (preset: AgentPreset) => {
    setSelectedId(preset.id);
    await createAgentSession(preset);
  };

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-background",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <Bot className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold">Agents</h2>
      </div>
      <div className="p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => handleSelect(AGENT_PRESETS[0])}
        >
          <Plus className="size-3.5" aria-hidden />
          New task
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
        <div className="space-y-0.5">
          {AGENT_PRESETS.map((preset) => (
            <AgentPresetRow
              key={preset.id}
              preset={preset}
              active={selectedId === preset.id}
              onClick={() => handleSelect(preset)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
