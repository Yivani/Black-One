import { AlertTriangle } from "lucide-react";
import {
  ChoiceCards,
  SettingsSection,
  SwitchRow,
} from "@/components/settings/SettingsPrimitives";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ToolPermission } from "@/types/settings";

/**
 * Agent permissions.
 *
 * The permission mode is written through `setToolPermission` rather than
 * `updateSection` because settings own the value and the tool runtime store
 * mirrors it; going through the store keeps the two from drifting.
 */
export function ToolSettings() {
  const { settings, updateSection } = useSettings();
  const setToolPermission = useSettingsStore((s) => s.setToolPermission);
  const { t } = useTranslation();
  const tools = settings.tools;

  const modes: Array<{ id: ToolPermission; label: string; description: string }> = [
    {
      id: "manual",
      label: t("tools.permissionManual"),
      description: t("tools.permissionManualDesc"),
    },
    {
      id: "auto",
      label: t("tools.permissionAuto"),
      description: t("tools.permissionAutoDesc"),
    },
    {
      id: "yolo",
      label: t("tools.permissionYolo"),
      description: t("tools.permissionYoloDesc"),
    },
    {
      id: "blocked",
      label: t("tools.permissionBlocked"),
      description: t("tools.permissionBlockedDesc"),
    },
  ];

  return (
    <div className="space-y-6">
      <SettingsSection title={t("tools.permission")}>
        <ChoiceCards
          label={t("tools.permission")}
          value={tools.permission}
          choices={modes}
          onChange={setToolPermission}
          columns={2}
        />
        {tools.permission === "yolo" && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <p className="text-xs leading-5 text-foreground">
              {t("tools.yoloWarning")}
            </p>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title={t("tools.capabilities")}>
        <SwitchRow
          id="file-tools"
          label={t("tools.fileTools")}
          description={t("tools.fileToolsDesc")}
          checked={tools.fileToolsEnabled}
          disabled={tools.permission === "blocked"}
          onCheckedChange={(fileToolsEnabled) =>
            updateSection("tools", { fileToolsEnabled })
          }
        />
        <SwitchRow
          id="shell-tools"
          label={t("tools.shellTools")}
          description={t("tools.shellToolsDesc")}
          checked={tools.shellToolsEnabled}
          disabled={tools.permission === "blocked"}
          onCheckedChange={(shellToolsEnabled) =>
            updateSection("tools", { shellToolsEnabled })
          }
        />
      </SettingsSection>
    </div>
  );
}
