import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  SelectRow,
  SettingRow,
  SettingsSection,
  SwitchRow,
} from "@/components/settings/SettingsPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import type { LogLevel } from "@/types/settings";

/**
 * Developer and diagnostic controls.
 *
 * Startup and tray behaviour used to live here; it moved to General, where a
 * non-developer will actually look for it.
 */
export function AdvancedSettings() {
  const { settings, updateSection } = useSettings();
  const { t } = useTranslation();
  const [draftName, setDraftName] = useState("");
  const [draftValue, setDraftValue] = useState("");

  const headers = settings.advanced.customHeaders;

  const addHeader = () => {
    const name = draftName.trim();
    if (!name) return;
    updateSection("advanced", {
      customHeaders: { ...headers, [name]: draftValue },
    });
    setDraftName("");
    setDraftValue("");
  };

  const removeHeader = (name: string) => {
    const next = { ...headers };
    delete next[name];
    updateSection("advanced", { customHeaders: next });
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={t("settings.advanced")}>
        <SwitchRow
          id="developer-mode"
          label={t("advanced.developerMode")}
          description={t("advanced.developerModeDesc")}
          checked={settings.advanced.developerMode}
          onCheckedChange={(developerMode) =>
            updateSection("advanced", { developerMode })
          }
        />
        <SwitchRow
          id="raw-responses"
          label={t("advanced.rawResponses")}
          description={t("advanced.rawResponsesDesc")}
          checked={settings.advanced.showRawResponses}
          onCheckedChange={(showRawResponses) =>
            updateSection("advanced", { showRawResponses })
          }
        />
        <SelectRow
          id="log-level"
          label={t("advanced.logLevel")}
          value={settings.advanced.logLevel}
          width="w-48"
          options={[
            { value: "error", label: "Error" },
            { value: "warn", label: "Warn" },
            { value: "info", label: "Info" },
            { value: "debug", label: "Debug" },
          ]}
          onValueChange={(value) =>
            updateSection("advanced", { logLevel: value as LogLevel })
          }
        />
      </SettingsSection>

      <SettingsSection
        title={t("advanced.customHeaders")}
        description={t("advanced.customHeadersDesc")}
      >
        {Object.entries(headers).length > 0 && (
          <div className="space-y-1.5">
            {Object.entries(headers).map(([name, value]) => (
              <div key={name} className="flex items-center gap-2">
                <Input
                  readOnly
                  value={name}
                  aria-label={t("advanced.headerName")}
                  className="w-56 font-mono text-xs"
                />
                <Input
                  value={value}
                  aria-label={t("advanced.headerValue")}
                  className="flex-1 font-mono text-xs"
                  onChange={(event) =>
                    updateSection("advanced", {
                      customHeaders: { ...headers, [name]: event.target.value },
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t("common.remove")} ${name}`}
                  onClick={() => removeHeader(name)}
                  className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}

        <SettingRow id="new-header" label={t("advanced.addHeader")} stacked>
          <div className="flex items-center gap-2">
            <Input
              id="new-header"
              value={draftName}
              placeholder={t("advanced.headerName")}
              className="w-56 font-mono text-xs"
              onChange={(event) => setDraftName(event.target.value)}
            />
            <Input
              value={draftValue}
              placeholder={t("advanced.headerValue")}
              className="flex-1 font-mono text-xs"
              onChange={(event) => setDraftValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addHeader();
              }}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={t("advanced.addHeader")}
              disabled={!draftName.trim()}
              onClick={addHeader}
              className="size-8 shrink-0"
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
