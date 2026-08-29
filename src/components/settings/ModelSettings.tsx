import { useMemo, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { formatContextWindow } from "@/lib/utils";
import { useModelStore } from "@/stores/modelStore";
import type { EffortLevel } from "@/types/settings";

interface FieldProps {
  id: string;
  label: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

function Field({ id, label, description, aside, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export function ModelSettings() {
  const { settings, updateSection } = useSettings();
  const providers = useModelStore((s) => s.providers);
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const selectModel = useModelStore((s) => s.selectModel);
  const selected = useModelStore(useShallow((s) => s.getSelectedModel()));
  const supportsThinking = selected?.model.capabilities.includes("reasoning") ?? false;
  const [modelQuery, setModelQuery] = useState("");

  const models = useMemo(
    () =>
      providers
        .filter((provider) => provider.isEnabled)
        .flatMap((provider) =>
          provider.models.map((model) => ({ provider, model })),
        ),
    [providers],
  );

  const modelIds = useMemo(
    () =>
      models.map(
        ({ provider, model }) =>
          model.selectionId ?? `${provider.id}::${model.id}`,
      ),
    [models],
  );

  const visibleModelIds = settings.model.visibleModelIds;
  const visibleModelSet = useMemo(
    () => new Set(visibleModelIds ?? modelIds),
    [visibleModelIds, modelIds],
  );

  const shownCount = useMemo(
    () => modelIds.filter((id) => visibleModelSet.has(id)).length,
    [modelIds, visibleModelSet],
  );

  const needle = modelQuery.trim().toLowerCase();
  const modelGroups = useMemo(
    () =>
      providers
        .filter((provider) => provider.isEnabled && provider.models.length > 0)
        .map((provider) => ({
          provider,
          models: provider.models.filter(
            (model) =>
              !needle ||
              model.name.toLowerCase().includes(needle) ||
              model.id.toLowerCase().includes(needle) ||
              provider.name.toLowerCase().includes(needle),
          ),
        }))
        .filter((group) => group.models.length > 0),
    [providers, needle],
  );

  const setModelVisible = (selectionId: string, visible: boolean) => {
    const next = new Set(visibleModelIds ?? modelIds);
    if (visible) next.add(selectionId);
    else next.delete(selectionId);
    updateSection("model", { visibleModelIds: [...next] });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Field
          id="default-model"
          label="Default model"
          description="Used when starting a new chat."
        >
          <Select value={selectedModelId} onValueChange={selectModel}>
            <SelectTrigger id="default-model" className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map(({ provider, model }) => (
                <SelectItem
                  key={model.selectionId ?? `${provider.id}::${model.id}`}
                  value={model.selectionId ?? `${provider.id}::${model.id}`}
                >
                  {provider.name} · {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>
      <Separator />
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Model picker</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Choose the models shown in the composer menu. This only changes
              your shortlist; it does not remove models from a provider.
            </p>
          </div>
          <Badge variant="secondary">
            {visibleModelIds === null
              ? `All ${modelIds.length}`
              : `${shownCount} of ${modelIds.length}`}
          </Badge>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            placeholder="Search all provider models..."
            aria-label="Search all provider models"
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => updateSection("model", { visibleModelIds: null })}
            >
              Show all
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedModelId}
              onClick={() =>
                updateSection("model", {
                  visibleModelIds: selectedModelId ? [selectedModelId] : [],
                })
              }
            >
              Only current
            </Button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border bg-card/40 p-2">
          {modelGroups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No provider models match this search.
            </p>
          ) : (
            <div className="space-y-3">
              {modelGroups.map(({ provider, models: providerModels }) => {
                const providerShown = provider.models.filter((model) =>
                  visibleModelSet.has(
                    model.selectionId ?? `${provider.id}::${model.id}`,
                  ),
                ).length;
                return (
                  <div key={provider.id} className="overflow-hidden rounded-md">
                    <div className="flex items-center justify-between bg-muted/45 px-3 py-2">
                      <span className="text-xs font-semibold">
                        {provider.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {providerShown}/{provider.models.length} shown
                      </span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {providerModels.map((model, index) => {
                        const selectionId =
                          model.selectionId ?? `${provider.id}::${model.id}`;
                        const toggleId = `model-visible-${provider.id}-${index}`;
                        return (
                          <label
                            key={selectionId}
                            htmlFor={toggleId}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/55"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {model.name}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {model.id}
                              </span>
                            </span>
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              {formatContextWindow(model.contextWindow)}
                            </Badge>
                            <Switch
                              id={toggleId}
                              checked={visibleModelSet.has(selectionId)}
                              onCheckedChange={(checked) =>
                                setModelVisible(selectionId, checked)
                              }
                              aria-label={`Show ${model.name} in the model picker`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <Field
          id="temperature"
          label="Temperature"
          description="Higher values make responses more creative, lower values more focused."
          aside={
            <Badge variant="secondary" className="font-mono">
              {settings.model.temperature.toFixed(1)}
            </Badge>
          }
        >
          <Slider
            id="temperature"
            aria-label="Temperature"
            min={0}
            max={2}
            step={0.1}
            value={[settings.model.temperature]}
            onValueChange={(value) =>
              updateSection("model", { temperature: value[0] })
            }
          />
        </Field>
        <Field
          id="max-tokens"
          label="Max tokens"
          description="Maximum response length (256–128,000)."
        >
          <Input
            id="max-tokens"
            type="number"
            min={256}
            max={128000}
            step={256}
            value={settings.model.maxTokens}
            onChange={(event) => {
              const maxTokens = event.target.valueAsNumber;
              if (Number.isFinite(maxTokens))
                updateSection("model", { maxTokens });
            }}
          />
        </Field>
        <Field
          id="top-p"
          label="Top-p"
          description="Nucleus sampling threshold. 1.0 considers every token."
          aside={
            <Badge variant="secondary" className="font-mono">
              {settings.model.topP.toFixed(2)}
            </Badge>
          }
        >
          <Slider
            id="top-p"
            aria-label="Top-p"
            min={0}
            max={1}
            step={0.05}
            value={[settings.model.topP]}
            onValueChange={(value) =>
              updateSection("model", { topP: value[0] })
            }
          />
        </Field>
        <Field
          id="thinking-enabled"
          label="Thinking"
          description={
            supportsThinking
              ? "Enable reasoning/thinking for models that support it."
              : "The selected model does not support thinking."
          }
        >
          <div className="flex items-center justify-between rounded-md border border-border p-2">
            <span className="text-sm">
              {settings.model.thinkingEnabled ? "On" : "Off"}
            </span>
            <Switch
              id="thinking-enabled"
              checked={settings.model.thinkingEnabled}
              disabled={!supportsThinking}
              onCheckedChange={(thinkingEnabled) =>
                updateSection("model", { thinkingEnabled })
              }
            />
          </div>
        </Field>
        <Field
          id="effort-level"
          label="Effort level"
          description="How much reasoning effort the model should use."
        >
          <Select
            value={settings.model.effortLevel}
            disabled={!supportsThinking || !settings.model.thinkingEnabled}
            onValueChange={(value) =>
              updateSection("model", { effortLevel: value as EffortLevel })
            }
          >
            <SelectTrigger id="effort-level" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(selected?.model.effortLevels ?? ["low", "medium", "high"]).map(
                (level) => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>
      </section>
    </div>
  );
}
