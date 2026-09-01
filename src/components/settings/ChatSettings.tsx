import {
  SelectRow,
  SettingRow,
  SettingsSection,
  SliderRow,
  SwitchRow,
} from "@/components/settings/SettingsPrimitives";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/locales";
import type {
  ChatPersonality,
  CodeTheme,
  ImageAttachmentMode,
  SendShortcut,
} from "@/types/settings";

/**
 * Every option here was already read by the app but had no control; this page
 * is what makes `settings.chat` actually adjustable.
 */

const PERSONALITIES: Array<{ id: ChatPersonality; labelKey: TranslationKey }> = [
  { id: "none", labelKey: "chat.personalityNone" },
  { id: "helpful", labelKey: "chat.personalityHelpful" },
  { id: "concise", labelKey: "chat.personalityConcise" },
  { id: "technical", labelKey: "chat.personalityTechnical" },
  { id: "creative", labelKey: "chat.personalityCreative" },
  { id: "teacher", labelKey: "chat.personalityTeacher" },
  { id: "kawaii", labelKey: "chat.personalityKawaii" },
  { id: "catgirl", labelKey: "chat.personalityCatgirl" },
  { id: "pirate", labelKey: "chat.personalityPirate" },
  { id: "shakespeare", labelKey: "chat.personalityShakespeare" },
];

export function ChatSettings() {
  const { settings, updateSection } = useSettings();
  const { t } = useTranslation();
  const chat = settings.chat;

  return (
    <div className="space-y-6">
      <SettingsSection title={t("chat.sending")}>
        <SelectRow
          id="send-with"
          label={t("chat.sendWith")}
          value={chat.sendWith}
          options={[
            { value: "enter", label: t("chat.sendWithEnter") },
            { value: "mod+enter", label: t("chat.sendWithMod") },
          ]}
          onValueChange={(value) =>
            updateSection("chat", { sendWith: value as SendShortcut })
          }
        />
        <SwitchRow
          id="auto-save"
          label={t("chat.autoSave")}
          description={t("chat.autoSaveDesc")}
          checked={chat.autoSave}
          onCheckedChange={(autoSave) => updateSection("chat", { autoSave })}
        />
      </SettingsSection>

      <SettingsSection title={t("chat.display")}>
        <SwitchRow
          id="show-timestamps"
          label={t("chat.showTimestamps")}
          description={t("chat.showTimestampsDesc")}
          checked={chat.showTimestamps}
          onCheckedChange={(showTimestamps) =>
            updateSection("chat", { showTimestamps })
          }
        />
        <SwitchRow
          id="show-reasoning"
          label={t("chat.showReasoning")}
          description={t("chat.showReasoningDesc")}
          checked={chat.showReasoningBlocks}
          onCheckedChange={(showReasoningBlocks) =>
            updateSection("chat", { showReasoningBlocks })
          }
        />
        <SelectRow
          id="code-theme"
          label={t("chat.codeTheme")}
          value={chat.codeTheme}
          options={[
            { value: "auto", label: t("chat.codeThemeAuto") },
            { value: "light", label: t("chat.codeThemeLight") },
            { value: "dark", label: t("chat.codeThemeDark") },
          ]}
          onValueChange={(value) =>
            updateSection("chat", { codeTheme: value as CodeTheme })
          }
        />
      </SettingsSection>

      <SettingsSection title={t("chat.behavior")}>
        <SelectRow
          id="personality"
          label={t("chat.personality")}
          description={t("chat.personalityDesc")}
          value={chat.personality}
          options={PERSONALITIES.map((entry) => ({
            value: entry.id,
            label: t(entry.labelKey),
          }))}
          onValueChange={(value) =>
            updateSection("chat", { personality: value as ChatPersonality })
          }
        />
        <SettingRow
          id="system-prompt"
          label={t("chat.systemPrompt")}
          description={t("chat.systemPromptDesc")}
          stacked
        >
          <Textarea
            id="system-prompt"
            rows={5}
            value={chat.defaultSystemPrompt}
            placeholder={t("chat.systemPromptPlaceholder")}
            onChange={(event) =>
              updateSection("chat", { defaultSystemPrompt: event.target.value })
            }
            className="resize-y font-mono text-xs"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("chat.attachments")}>
        <SelectRow
          id="image-mode"
          label={t("chat.imageMode")}
          description={t("chat.imageModeDesc")}
          value={chat.imageAttachmentMode}
          options={[
            { value: "auto", label: t("chat.imageModeAuto") },
            { value: "text-only", label: t("chat.imageModeTextOnly") },
            { value: "disabled", label: t("chat.imageModeDisabled") },
          ]}
          onValueChange={(value) =>
            updateSection("chat", {
              imageAttachmentMode: value as ImageAttachmentMode,
            })
          }
        />
        <SliderRow
          id="preview-size"
          label={t("chat.previewSize")}
          description={t("chat.previewSizeDesc")}
          value={chat.maxPreviewSizeMb}
          min={1}
          max={64}
          step={1}
          format={(value) => `${value} MB`}
          onValueChange={(maxPreviewSizeMb) =>
            updateSection("chat", { maxPreviewSizeMb })
          }
        />
      </SettingsSection>
    </div>
  );
}
