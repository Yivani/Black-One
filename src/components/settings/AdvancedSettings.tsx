import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { ipc, isTauri } from "@/lib/ipc";
import type { LogLevel } from "@/types/settings";

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function AdvancedSettings() {
  const { settings, updateSection } = useSettings();
  const [autoStart, setAutoStart] = useState(
    settings.advanced.autoStartWithOs,
  );

  useEffect(() => {
    if (!isTauri) return;
    ipc
      .isAutoStartEnabled()
      .then(setAutoStart)
      .catch(() => setAutoStart(settings.advanced.autoStartWithOs));
  }, [settings.advanced.autoStartWithOs]);

  const handleAutoStartChange = async (enabled: boolean) => {
    updateSection("advanced", { autoStartWithOs: enabled });
    if (!isTauri) return;
    try {
      await ipc.setAutoStart(enabled);
      setAutoStart(enabled);
    } catch (error) {
      setAutoStart(!enabled);
      toast.error(
        error instanceof Error ? error.message : "Failed to update auto-start.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SwitchRow
          id="minimize-to-tray"
          label="Minimize to tray on close"
          description="Keep Black One running when the main window closes."
          checked={settings.advanced.minimizeToTray}
          onCheckedChange={(minimizeToTray) =>
            updateSection("advanced", { minimizeToTray })
          }
        />
        <SwitchRow
          id="start-minimized"
          label="Start minimized"
          description="Launch Black One directly into the system tray."
          checked={settings.advanced.startMinimized}
          onCheckedChange={(startMinimized) =>
            updateSection("advanced", { startMinimized })
          }
        />
        <SwitchRow
          id="auto-start"
          label="Start with Windows"
          description="Launch Black One when you sign in."
          checked={autoStart}
          onCheckedChange={(enabled) => void handleAutoStartChange(enabled)}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <Label htmlFor="log-level">Diagnostic log level</Label>
        <Select
          value={settings.advanced.logLevel}
          onValueChange={(value) =>
            updateSection("advanced", { logLevel: value as LogLevel })
          }
        >
          <SelectTrigger id="log-level" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
      </section>
    </div>
  );
}
