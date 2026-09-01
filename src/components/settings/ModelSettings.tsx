import { useMemo } from "react";
import { Check } from "lucide-react";
import {
  SelectRow,
  SettingsNote,
  SettingsSection,
  SliderRow,
  SwitchRow,
} from "@/components/settings/SettingsPrimitives";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/stores/modelStore";

/**
 * Sampling, reasoning, and which models reach the composer's picker.
 *
 * `visibleModelIds` is stored as null for "show everything" so a newly added
 * provider's models appear without the user having to opt them in.
 */
export function ModelSettings() {
  const { settings, updateSection } = useSettings();
  const { t } = useTranslation();
  const providers = useModelStore((s) => s.providers);
  const model = settings.model;

  const groups = useMemo(
    () =>
      providers
        .map((provider) => ({
          provider,
          models: provider.models.map((entry) => ({
            ...entry,
            selectionId: entry.selectionId ?? `${provider.id}::${entry.id}`,
          })),
        }))
        .filter((group) => group.models.length > 0),
    [providers],
  );

  const visible = settings.model.visibleModelIds;
  const isVisible = (id: string) => visible === null || visible.includes(id);

  const toggleModel = (id: string) => {
    const everyId = groups.flatMap((group) =>
      group.models.map((entry) => entry.selectionId),
    );
    const current = visible ?? everyId;
    const next = current.includes(id)
      ? current.filter((entry) => entry !== id)
      : [...current, id];
    // Back to null once everything is on, so future models are visible too.
    updateSection("model", {
      visibleModelIds: next.length === everyId.length ? null : next,
    });
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={t("models.sampling")}>
        <SliderRow
          id="temperature"
          label={t("models.temperature")}
          description={t("models.temperatureDesc")}
          value={model.temperature}
          min={0}
          max={2}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onValueChange={(temperature) => updateSection("model", { temperature })}
        />
        <SliderRow
          id="max-tokens"
          label={t("models.maxTokens")}
          description={t("models.maxTokensDesc")}
          value={model.maxTokens}
          min={256}
          max={32768}
          step={256}
          format={(value) => value.toLocaleString()}
          onValueChange={(maxTokens) => updateSection("model", { maxTokens })}
        />
        <SliderRow
          id="top-p"
          label={t("models.topP")}
          description={t("models.topPDesc")}
          value={model.topP}
          min={0.1}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onValueChange={(topP) => updateSection("model", { topP })}
        />
      </SettingsSection>

      <SettingsSection title={t("models.reasoning")}>
        <SwitchRow
          id="thinking-enabled"
          label={t("models.thinkingEnabled")}
          description={t("models.thinkingEnabledDesc")}
          checked={model.thinkingEnabled}
          onCheckedChange={(thinkingEnabled) =>
            updateSection("model", { thinkingEnabled })
          }
        />
        <SelectRow
          id="effort-level"
          label={t("models.effort")}
          value={model.effortLevel}
          options={[
            { value: "low", label: t("models.effortLow") },
            { value: "medium", label: t("models.effortMedium") },
            { value: "high", label: t("models.effortHigh") },
          ]}
          onValueChange={(effortLevel) => updateSection("model", { effortLevel })}
        />
      </SettingsSection>

      <SettingsSection
        title={t("models.visibility")}
        description={t("models.visibilityDesc")}
      >
        {groups.length === 0 ? (
          <SettingsNote>
            {t("models.noProviders")} {t("models.addProvider")}
          </SettingsNote>
        ) : (
          <div className="space-y-4">
            {groups.map(({ provider, models }) => (
              <div key={provider.id}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  {provider.name}
                </p>
                <div className="space-y-px">
                  {models.map((entry) => {
                    const shown = isVisible(entry.selectionId);
                    return (
                      <button
                        key={entry.selectionId}
                        type="button"
                        role="checkbox"
                        aria-checked={shown}
                        onClick={() => toggleModel(entry.selectionId)}
                        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-standard hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border",
                            shown
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                          aria-hidden
                        >
                          {shown && <Check className="size-3" />}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            !shown && "text-muted-foreground",
                          )}
                        >
                          {entry.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
