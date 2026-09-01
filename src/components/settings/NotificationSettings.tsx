import { useState } from "react";
import { toast } from "sonner";
import {
  SettingRow,
  SettingsNote,
  SettingsSection,
  SwitchRow,
} from "@/components/settings/SettingsPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { isTauri } from "@/lib/ipc";
import { notificationPermissionDenied, sendNotification } from "@/lib/notify";
import { parseHhMm } from "@/lib/notifyCore";

/**
 * Desktop notifications.
 *
 * These settings existed in the schema but nothing read them; the sending side
 * now lives in `@/lib/notify` and the transition watchers in `useSystemBridge`.
 */
export function NotificationSettings() {
  const { settings, updateSection } = useSettings();
  const { t } = useTranslation();
  const [denied, setDenied] = useState(notificationPermissionDenied());
  const notifications = settings.notifications;

  const handleTest = async () => {
    const sent = await sendNotification(
      t("notifications.testTitle"),
      t("notifications.testBody"),
    );
    setDenied(notificationPermissionDenied());
    if (!sent) toast.error(t("notifications.permissionDenied"));
  };

  // Reject a half-typed time rather than persisting a value quiet hours cannot
  // parse, which would silently disable the window.
  const handleTime = (field: "dndStart" | "dndEnd", value: string) => {
    if (value !== "" && parseHhMm(value) === null) return;
    updateSection("notifications", { [field]: value });
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={t("notifications.alerts")}>
        <SwitchRow
          id="desktop-notifications"
          label={t("notifications.desktop")}
          description={t("notifications.desktopDesc")}
          checked={notifications.desktopEnabled}
          onCheckedChange={(desktopEnabled) =>
            updateSection("notifications", { desktopEnabled })
          }
        />
        <SwitchRow
          id="approval-notifications"
          label={t("notifications.approval")}
          description={t("notifications.approvalDesc")}
          checked={notifications.approvalsEnabled}
          disabled={!notifications.desktopEnabled}
          onCheckedChange={(approvalsEnabled) =>
            updateSection("notifications", { approvalsEnabled })
          }
        />
        <SwitchRow
          id="notification-sounds"
          label={t("notifications.sounds")}
          description={t("notifications.soundsDesc")}
          checked={notifications.soundsEnabled}
          disabled={!notifications.desktopEnabled}
          onCheckedChange={(soundsEnabled) =>
            updateSection("notifications", { soundsEnabled })
          }
        />

        {denied && <SettingsNote>{t("notifications.permissionDenied")}</SettingsNote>}

        {isTauri && (
          <Button variant="outline" size="sm" onClick={() => void handleTest()}>
            {t("notifications.test")}
          </Button>
        )}
      </SettingsSection>

      <SettingsSection title={t("notifications.quietHours")}>
        <SwitchRow
          id="quiet-hours"
          label={t("notifications.quietHours")}
          description={t("notifications.quietHoursDesc")}
          checked={notifications.dndEnabled}
          onCheckedChange={(dndEnabled) =>
            updateSection("notifications", { dndEnabled })
          }
        />
        <SettingRow
          id="quiet-from"
          label={t("notifications.quietWindow")}
          stacked
        >
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quiet-from" className="text-xs text-muted-foreground">
                {t("notifications.from")}
              </Label>
              <Input
                id="quiet-from"
                type="time"
                className="w-32"
                disabled={!notifications.dndEnabled}
                value={notifications.dndStart}
                onChange={(event) => handleTime("dndStart", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet-to" className="text-xs text-muted-foreground">
                {t("notifications.to")}
              </Label>
              <Input
                id="quiet-to"
                type="time"
                className="w-32"
                disabled={!notifications.dndEnabled}
                value={notifications.dndEnd}
                onChange={(event) => handleTime("dndEnd", event.target.value)}
              />
            </div>
          </div>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
