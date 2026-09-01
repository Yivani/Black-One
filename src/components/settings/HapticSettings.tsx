import { useState } from "react";
import { FolderOpen, Music, Play, RotateCcw, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { ipc, isTauri } from "@/lib/ipc";
import { previewAppSound, releaseAudio } from "@/lib/sounds";
import {
  SOUND_FAMILIES,
  SOUNDS,
  soundsInFamily,
  type SoundFamily,
  type SoundId,
} from "@/lib/soundCore";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/locales";
import type { HapticSettings as HapticSettingsValue } from "@/types/settings";

/** Which setting each family's switch writes. */
const FAMILY_KEYS: Record<SoundFamily, keyof HapticSettingsValue> = {
  interface: "interfaceSounds",
  messages: "messageSounds",
  alerts: "alertSounds",
  activity: "activitySounds",
};

/** Custom-file overrides, for the three sounds that have ever had one. */
const CUSTOM_SLOTS: Array<{
  key: "clickSound" | "finishSound" | "errorSound";
  labelKey: TranslationKey;
  preview: SoundId;
}> = [
  { key: "clickSound", labelKey: "haptics.customClick", preview: "click" },
  { key: "finishSound", labelKey: "haptics.customFinish", preview: "complete" },
  { key: "errorSound", labelKey: "haptics.customError", preview: "error" },
];

function SwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/** One sound, with a button that plays it. */
function SoundChip({ id, muted }: { id: SoundId; muted: boolean }) {
  const { t } = useTranslation();
  const label = t(SOUNDS[id].labelKey as TranslationKey);

  return (
    <button
      type="button"
      // The global click sound would land on top of the preview.
      data-haptic="false"
      onClick={() => previewAppSound(id)}
      aria-label={t("haptics.play", { sound: label })}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition-standard",
        "hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        muted && "opacity-50",
      )}
    >
      <Play className="size-3 text-muted-foreground" aria-hidden />
      {label}
    </button>
  );
}

function CustomSoundRow({
  label,
  sound,
  onChange,
  onPreview,
}: {
  label: string;
  sound: string;
  onChange: (sound: string) => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const isCustom = sound !== "default" && !!sound;
  const fileName = isCustom
    ? (sound.replace(/\\/g, "/").split("/").pop() ?? sound)
    : t("haptics.builtIn");

  const pickFile = async () => {
    if (!isTauri) {
      toast.info(t("haptics.desktopOnly"));
      return;
    }
    setPicking(true);
    try {
      const path = await ipc.pickSoundFile();
      if (path) onChange(path);
    } catch (error) {
      toast.error(t("haptics.customFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Music className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
        <span
          className={cn(
            "truncate text-xs",
            isCustom ? "text-foreground" : "text-muted-foreground",
          )}
          title={isCustom ? sound : undefined}
        >
          {fileName}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          data-haptic="false"
          onClick={onPreview}
        >
          {t("haptics.test")}
        </Button>
        {isCustom && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange("default")}
          >
            {t("haptics.useBuiltIn")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => void pickFile()}
          disabled={picking}
        >
          <FolderOpen className="mr-1 size-3.5" aria-hidden />
          {picking ? t("haptics.choosing") : t("haptics.chooseFile")}
        </Button>
      </div>
    </div>
  );
}

export function HapticSettings() {
  const { t } = useTranslation();
  const { settings, updateSection } = useSettings();
  const haptics = settings.haptics;
  const silent = !haptics.enabled || haptics.volume === 0;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SwitchRow
          id="haptics-enabled"
          label={t("haptics.enabled")}
          description={t("haptics.enabledDesc")}
          checked={haptics.enabled}
          onCheckedChange={(enabled) => {
            updateSection("haptics", { enabled });
            // Hand the audio device back when the app goes quiet.
            if (!enabled) releaseAudio();
          }}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-muted-foreground" aria-hidden />
              <Label htmlFor="haptic-volume">{t("haptics.volume")}</Label>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(haptics.volume * 100)}%
            </span>
          </div>
          <Slider
            id="haptic-volume"
            min={0}
            max={100}
            step={1}
            value={[Math.round(haptics.volume * 100)]}
            onValueChange={([value]) =>
              updateSection("haptics", { volume: value / 100 })
            }
            // Hear the level being set, not just see the number.
            onValueCommit={() => previewAppSound("click")}
            disabled={!haptics.enabled}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {t("haptics.sounds")}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {t("haptics.soundsDesc")}
          </p>
        </div>

        <div className="space-y-3">
          {SOUND_FAMILIES.map((family) => {
            const key = FAMILY_KEYS[family.id];
            const on = haptics[key] as boolean;
            return (
              <div
                key={family.id}
                className="space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-3"
              >
                <SwitchRow
                  id={`haptics-${family.id}`}
                  label={t(family.labelKey as TranslationKey)}
                  description={t(family.descriptionKey as TranslationKey)}
                  checked={on}
                  disabled={!haptics.enabled}
                  onCheckedChange={(value) =>
                    updateSection("haptics", { [key]: value })
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {soundsInFamily(family.id).map((id) => (
                    <SoundChip key={id} id={id} muted={silent || !on} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {t("haptics.customTitle")}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {t("haptics.customDesc")}
          </p>
        </div>
        <div className="space-y-2">
          {CUSTOM_SLOTS.map(({ key, labelKey, preview }) => (
            <CustomSoundRow
              key={key}
              label={t(labelKey)}
              sound={haptics[key]}
              onChange={(value) => updateSection("haptics", { [key]: value })}
              onPreview={() => previewAppSound(preview)}
            />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            updateSection("haptics", { ...DEFAULT_SETTINGS.haptics });
            releaseAudio();
          }}
        >
          <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
          {t("haptics.reset")}
        </Button>
      </section>
    </div>
  );
}
