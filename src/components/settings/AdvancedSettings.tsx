import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { ipc, isTauri } from "@/lib/ipc";
import { generateId } from "@/lib/utils";
import type { LogLevel } from "@/types/settings";

interface SwitchRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SwitchRow({ id, label, description, checked, onCheckedChange }: SwitchRowProps) {
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

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

export function AdvancedSettings() {
  const { settings, updateSection } = useSettings();
  const [autoStart, setAutoStart] = useState(settings.advanced.autoStartWithOs);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() =>
    Object.entries(settings.advanced.customHeaders).map(([key, value]) => ({
      id: generateId(),
      key,
      value,
    })),
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
      toast.error(error instanceof Error ? error.message : "Failed to update auto-start.");
      setAutoStart(!enabled);
    }
  };

  const commitHeaders = (rows: HeaderRow[]) => {
    setHeaderRows(rows);
    const customHeaders: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (key) customHeaders[key] = row.value;
    }
    updateSection("advanced", { customHeaders });
  };

  const updateRow = (id: string, patch: Partial<Omit<HeaderRow, "id">>) => {
    commitHeaders(headerRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    commitHeaders(headerRows.filter((row) => row.id !== id));
  };

  const addRow = () => {
    setHeaderRows([...headerRows, { id: generateId(), key: "", value: "" }]);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SwitchRow
          id="developer-mode"
          label="Developer mode"
          description="Enable debugging tools and verbose diagnostics."
          checked={settings.advanced.developerMode}
          onCheckedChange={(developerMode) => updateSection("advanced", { developerMode })}
        />
        <SwitchRow
          id="show-raw-responses"
          label="Show raw API responses"
          description="Display the unprocessed payload returned by providers."
          checked={settings.advanced.showRawResponses}
          onCheckedChange={(showRawResponses) =>
            updateSection("advanced", { showRawResponses })
          }
        />
      </section>
      <Separator />
      <section className="space-y-4">
        <p className="text-sm font-medium leading-none">System behavior</p>
        <SwitchRow
          id="minimize-to-tray"
          label="Minimize to tray on close"
          description="Keep Black One running in the system tray when you close the window."
          checked={settings.advanced.minimizeToTray}
          onCheckedChange={(minimizeToTray) => updateSection("advanced", { minimizeToTray })}
        />
        <SwitchRow
          id="start-minimized"
          label="Start minimized"
          description="Launch directly to the system tray without opening a window."
          checked={settings.advanced.startMinimized}
          onCheckedChange={(startMinimized) => updateSection("advanced", { startMinimized })}
        />
        <SwitchRow
          id="auto-start"
          label="Start with Windows"
          description="Launch Black One automatically when you sign in to Windows."
          checked={autoStart}
          onCheckedChange={handleAutoStartChange}
        />
      </section>
      <Separator />
      <section className="space-y-2">
        <p className="text-sm font-medium leading-none">Custom headers</p>
        <p className="text-xs text-muted-foreground">
          Sent with every provider request.
        </p>
        <div className="space-y-2">
          {headerRows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.key}
                onChange={(event) => updateRow(row.id, { key: event.target.value })}
                placeholder="Header"
                aria-label="Header name"
              />
              <Input
                value={row.value}
                onChange={(event) => updateRow(row.id, { value: event.target.value })}
                placeholder="Value"
                aria-label="Header value"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove header"
                onClick={() => removeRow(row.id)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" aria-hidden />
          Add header
        </Button>
      </section>
      <Separator />
      <section className="space-y-2">
        <Label htmlFor="log-level">Log level</Label>
        <Select
          value={settings.advanced.logLevel}
          onValueChange={(value) => updateSection("advanced", { logLevel: value as LogLevel })}
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
