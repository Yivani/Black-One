import { useState } from "react";
import { FolderOpen, Music, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { playClickSound, playErrorSound, playFinishSound } from "@/hooks/useHaptics";
import { ipc, isTauri } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function soundLabel(sound: string): string {
  if (sound === "default" || !sound) return "Default";
  const parts = sound.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "Custom";
}

interface SoundRowProps {
  label: string;
  sound: string;
  onChange: (sound: string) => void;
  onTest: () => void;
}

function SoundRow({ label, sound, onChange, onTest }: SoundRowProps) {
  const [isPicking, setIsPicking] = useState(false);
  const isCustom = sound !== "default" && !!sound;

  const pickFile = async () => {
    if (!isTauri) {
      toast.info("Custom sounds are only available in the desktop app.");
      return;
    }
    setIsPicking(true);
    try {
      const path = await ipc.pickSoundFile();
      if (path) onChange(path);
    } catch (error) {
      toast.error("Could not use the selected sound.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Music className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void pickFile()}
            disabled={isPicking}
          >
            <FolderOpen className="mr-1.5 size-3.5" aria-hidden />
            {isPicking ? "Choosing…" : "Choose file"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onTest}>
            Test
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange("default")}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            !isCustom
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Default
        </button>
        <span
          className={cn(
            "truncate text-xs",
            isCustom ? "text-foreground" : "text-muted-foreground",
          )}
          title={sound}
        >
          {isCustom ? soundLabel(sound) : "Built-in sound"}
        </span>
      </div>
    </div>
  );
}

export function HapticSettings() {
  const { settings, updateSection } = useSettings();
  const haptics = settings.haptics;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SwitchRow
          id="haptics-enabled"
          label="Enable haptics"
          description="Vibration, click sounds, and finish sounds."
          checked={haptics.enabled}
          onCheckedChange={(enabled) => updateSection("haptics", { enabled })}
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-muted-foreground" aria-hidden />
              <Label htmlFor="haptic-volume">Sound volume</Label>
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
            disabled={!haptics.enabled}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <SoundRow
          label="Click sound"
          sound={haptics.clickSound}
          onChange={(clickSound) => updateSection("haptics", { clickSound })}
          onTest={() => {
            if (!haptics.enabled) return;
            playClickSound();
          }}
        />
        <SoundRow
          label="Finish sound"
          sound={haptics.finishSound}
          onChange={(finishSound) => updateSection("haptics", { finishSound })}
          onTest={() => {
            if (!haptics.enabled) return;
            playFinishSound();
          }}
        />
        <SoundRow
          label="Error sound"
          sound={haptics.errorSound}
          onChange={(errorSound) => updateSection("haptics", { errorSound })}
          onTest={() => {
            if (!haptics.enabled) return;
            playErrorSound();
          }}
        />
      </section>

      <Separator />

      <section>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateSection("haptics", {
              enabled: true,
              volume: 0.2,
              clickSound: "default",
              finishSound: "default",
              errorSound: "default",
            })
          }
        >
          <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
          Reset to defaults
        </Button>
      </section>
    </div>
  );
}
