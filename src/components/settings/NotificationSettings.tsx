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
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { APP_NAME, NOTIFICATION_SOUNDS } from "@/lib/constants";
import { isTauri } from "@/lib/ipc";

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function NotificationSettings() {
  const { settings, updateSection } = useSettings();
  const dndEnabled = settings.notifications.dndEnabled;

  const testNotification = async () => {
    if (!isTauri) {
      toast(`${APP_NAME} test notification`);
      return;
    }
    try {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      sendNotification({ title: APP_NAME, body: "Test notification" });
    } catch {
      toast.error("Failed to send the test notification.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SwitchRow
          id="desktop-notifications"
          label="Desktop notifications"
          description="Notify when a response finishes in the background."
          checked={settings.notifications.desktopEnabled}
          onCheckedChange={(desktopEnabled) =>
            updateSection("notifications", { desktopEnabled })
          }
        />
        <SwitchRow
          id="sound-effects"
          label="Sound effects"
          description="Play a sound with notifications."
          checked={settings.notifications.soundsEnabled}
          onCheckedChange={(soundsEnabled) =>
            updateSection("notifications", { soundsEnabled })
          }
        />
        <div className="space-y-2">
          <Label htmlFor="notification-sound">Sound</Label>
          <div className="flex items-center gap-2">
            <Select
              value={settings.notifications.soundName}
              onValueChange={(soundName) => updateSection("notifications", { soundName })}
            >
              <SelectTrigger id="notification-sound" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_SOUNDS.map((sound) => (
                  <SelectItem key={sound} value={sound}>
                    {capitalize(sound)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void testNotification()}>
              Test
            </Button>
          </div>
        </div>
      </section>
      <Separator />
      <section className="space-y-4">
        <SwitchRow
          id="dnd-enabled"
          label="Do not disturb"
          description="Silence notifications during the hours below."
          checked={dndEnabled}
          onCheckedChange={(enabled) => updateSection("notifications", { dndEnabled: enabled })}
        />
        <div className="flex items-center gap-4">
          <div className="space-y-2">
            <Label htmlFor="dnd-start">From</Label>
            <Input
              id="dnd-start"
              type="time"
              className="w-28"
              value={settings.notifications.dndStart}
              disabled={!dndEnabled}
              onChange={(event) =>
                updateSection("notifications", { dndStart: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnd-end">Until</Label>
            <Input
              id="dnd-end"
              type="time"
              className="w-28"
              value={settings.notifications.dndEnd}
              disabled={!dndEnabled}
              onChange={(event) =>
                updateSection("notifications", { dndEnd: event.target.value })
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
