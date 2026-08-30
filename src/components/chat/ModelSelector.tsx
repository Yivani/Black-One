import { useState } from "react";
import { Check, ChevronsUpDown, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useModels } from "@/hooks/useModels";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { cn, formatContextWindow } from "@/lib/utils";

const BADGED_CAPABILITIES = new Set(["vision", "tools", "reasoning"]);

export function ModelSelector() {
  const {
    providers,
    selected,
    selectedModelId,
    isRefreshing,
    selectModel,
    refreshModels,
  } = useModels();
  const openSettings = useUiStore((s) => s.openSettings);
  const visibleModelIds = useSettingsStore(
    (s) => s.settings.model.visibleModelIds,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visibleModelSet = visibleModelIds ? new Set(visibleModelIds) : null;
  const groups = providers
    .filter(
      (provider) =>
        provider.isEnabled ||
        provider.models.some((m) => m.selectionId === selectedModelId),
    )
    .map((provider) => ({
      provider,
      models: provider.models.filter((model) => {
        const selectionId = model.selectionId ?? `${provider.id}::${model.id}`;
        if (visibleModelSet && !visibleModelSet.has(selectionId)) return false;
        return (
          !needle ||
          model.name.toLowerCase().includes(needle) ||
          model.id.toLowerCase().includes(needle) ||
          provider.name.toLowerCase().includes(needle)
        );
      }),
    }))
    .filter((group) => group.models.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2"
          aria-label="Select model"
          data-haptic="false"
        >
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="max-w-48 truncate text-sm">
            {selected?.model.name ?? "Select model"}
          </span>
          <ChevronsUpDown
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="flex max-h-[min(440px,var(--radix-popover-content-available-height))] w-[min(26rem,calc(100vw-24px))] flex-col overflow-hidden p-0"
      >
        <div className="border-b border-border p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models…"
            aria-label="Search models"
            className="h-8 text-sm"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-1">
            {groups.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {visibleModelSet
                  ? "No shortlisted models found."
                  : "No models found."}
              </p>
            )}
            {groups.map(({ provider, models }) => (
              <div key={provider.id}>
                <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">
                  {provider.name}
                </p>
                {models.map((model) => (
                  <button
                    key={model.selectionId ?? `${provider.id}::${model.id}`}
                    type="button"
                    title={model.description}
                    onClick={() => {
                      selectModel(
                        model.selectionId ?? `${provider.id}::${model.id}`,
                      );
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-standard hover:bg-accent"
                  >
                    {(model.selectionId ?? model.id) === selectedModelId ? (
                      <Check className="size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <span className="size-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {model.name}
                      </span>
                      <span className="mt-0.5 flex gap-1">
                        {model.capabilities
                          .filter((capability) =>
                            BADGED_CAPABILITIES.has(capability),
                          )
                          .slice(0, 3)
                          .map((capability) => (
                            <span
                              key={capability}
                              className="text-[9px] uppercase tracking-wide text-muted-foreground"
                            >
                              {capability}
                            </span>
                          ))}
                      </span>
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {formatContextWindow(model.contextWindow)}
                    </Badge>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 border-t border-border bg-popover p-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Refresh models"
            onClick={() =>
              refreshModels().catch((error: unknown) =>
                toast.error(
                  error instanceof Error ? error.message : String(error),
                ),
              )
            }
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
              aria-hidden
            />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setOpen(false);
              openSettings("providers");
            }}
          >
            <Settings2 className="size-3.5" aria-hidden />
            Edit models
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
