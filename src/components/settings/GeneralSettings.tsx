import { useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import {
  ChoiceCards,
  SelectRow,
  SettingsNote,
  SettingsSection,
  SwitchRow,
} from "@/components/settings/SettingsPrimitives";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { LANGUAGES, type LanguagePreference } from "@/lib/i18n";
import { ipc, isTauri } from "@/lib/ipc";

/**
 * Names the launch-at-login toggle after the platform it registers with.
 * Returns null when the platform is unknown, so the caller can fall back to a
 * fully translated label instead of splicing an English word into a sentence.
 */
function platformLabel(platform: string | undefined): string | null {
  switch (platform) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return null;
  }
}

/** Two-letter language badge. See `LanguageOption.code` for why not a flag. */
function LanguageBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded border border-border bg-muted/60 px-1.5 font-mono text-[11px] font-semibold tracking-wide text-foreground">
      {code}
    </span>
  );
}

/**
 * Time zones the user is likely to want, plus whatever theirs actually is —
 * `Intl.supportedValuesOf` lists several hundred, which is a worse picker than
 * a short list that always contains the right answer.
 */
function timezoneOptions(systemZone: string): Array<{ value: string; label: string }> {
  const common = [
    "UTC",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Moscow",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  const zones = common.includes(systemZone) ? common : [systemZone, ...common];
  return zones.filter(Boolean).map((zone) => ({ value: zone, label: zone }));
}

export function GeneralSettings() {
  const { settings, updateSection } = useSettings();
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<string>();
  const [autoStart, setAutoStart] = useState(settings.advanced.autoStartWithOs);

  const systemZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  useEffect(() => {
    if (!isTauri) return;
    void ipc.getAppInfo().then((info) => setPlatform(info.platform));
    // The OS entry is the source of truth: a reinstall can clear it while the
    // saved preference still says "on".
    ipc
      .isAutoStartEnabled()
      .then(setAutoStart)
      .catch(() => setAutoStart(settings.advanced.autoStartWithOs));
  }, [settings.advanced.autoStartWithOs]);

  const handleAutoStart = async (enabled: boolean) => {
    updateSection("advanced", { autoStartWithOs: enabled });
    if (!isTauri) return;
    try {
      await ipc.setAutoStart(enabled);
      setAutoStart(enabled);
    } catch (error) {
      setAutoStart(!enabled);
      updateSection("advanced", { autoStartWithOs: !enabled });
      toast.error(
        error instanceof Error ? error.message : "Failed to update auto-start.",
      );
    }
  };

  const languageChoices = [
    {
      id: "system" as LanguagePreference,
      label: t("general.languageSystem"),
      glyph: <Globe className="size-4 text-muted-foreground" aria-hidden />,
    },
    ...LANGUAGES.map((language) => ({
      id: language.id as LanguagePreference,
      label: language.nativeLabel,
      glyph: <LanguageBadge code={language.code} />,
    })),
  ];

  const os = platformLabel(platform);

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t("general.languageRegion")}
        description={t("general.languageDesc")}
      >
        <ChoiceCards
          label={t("general.language")}
          value={settings.general.language}
          choices={languageChoices}
          onChange={(language) => updateSection("general", { language })}
          columns={2}
        />
        <SettingsNote>{t("general.languageCoverage")}</SettingsNote>

        <SelectRow
          id="timezone"
          label={t("general.timezone")}
          description={t("general.timezoneDesc")}
          value={settings.chat.timezone || systemZone}
          options={timezoneOptions(systemZone)}
          onValueChange={(timezone) => updateSection("chat", { timezone })}
        />
      </SettingsSection>

      <SettingsSection title={t("general.startup")}>
        <SwitchRow
          id="auto-start"
          label={os ? t("general.autoStart", { os }) : t("general.autoStartGeneric")}
          description={t("general.autoStartDesc")}
          checked={autoStart}
          onCheckedChange={(enabled) => void handleAutoStart(enabled)}
        />
        <SwitchRow
          id="start-minimized"
          label={t("general.startMinimized")}
          description={t("general.startMinimizedDesc")}
          checked={settings.advanced.startMinimized}
          onCheckedChange={(startMinimized) =>
            updateSection("advanced", { startMinimized })
          }
        />
        <SwitchRow
          id="minimize-to-tray"
          label={t("general.minimizeToTray")}
          description={t("general.minimizeToTrayDesc")}
          checked={settings.advanced.minimizeToTray}
          onCheckedChange={(minimizeToTray) =>
            updateSection("advanced", { minimizeToTray })
          }
        />
        <SwitchRow
          id="tray-status"
          label={t("general.trayStatus")}
          description={t("general.trayStatusDesc")}
          checked={settings.general.trayStatus}
          onCheckedChange={(trayStatus) => updateSection("general", { trayStatus })}
        />
        <SwitchRow
          id="auto-update-check"
          label={t("general.autoUpdateCheck")}
          description={t("general.autoUpdateCheckDesc")}
          checked={settings.general.autoUpdateCheck}
          onCheckedChange={(autoUpdateCheck) =>
            updateSection("general", { autoUpdateCheck })
          }
        />
      </SettingsSection>
    </div>
  );
}
