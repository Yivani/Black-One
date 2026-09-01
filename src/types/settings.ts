import type { LanguagePreference } from "@/lib/i18n";

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";
export type SidebarPosition = "left" | "right";
export type AccentColorId =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "violet"
  | "red"
  | "pink"
  | "cyan"
  | "teal"
  | "orange"
  | "indigo"
  | "rose"
  | "sky"
  | "custom";
export type CodeTheme = "light" | "dark" | "auto";
export type ContentFilterLevel = "off" | "moderate" | "strict";
export type LogLevel = "error" | "warn" | "info" | "debug";
export type SendShortcut = "enter" | "mod+enter";
export type RejectionStyle = "brief" | "explained";
/**
 * The single tool-permission vocabulary, shared by persisted settings and the
 * runtime store. Kept identical to `ToolPermissionMode` in `@/lib/tools` so a
 * mode can round-trip instead of being mapped onto a weaker one.
 */
export type ToolPermission = "manual" | "auto" | "yolo" | "blocked";
/** Values written by releases before the vocabularies were merged. */
export type LegacyToolPermission = "ask" | "allowlisted";
export type ThemePresetId =
  | "default"
  | "ocean"
  | "warm"
  | "forest"
  | "berry"
  | "sunset"
  | "coffee"
  | "mint"
  | "lime"
  | "nord"
  | "dracula"
  | "solarized"
  | "sakura"
  | "amber"
  | "midnight"
  | "slate"
  | "crimson"
  | "vapor"
  | "phosphor"
  | "sage"
  | "contrast";
export type ChatPersonality =
  | "none"
  | "helpful"
  | "concise"
  | "technical"
  | "creative"
  | "teacher"
  | "kawaii"
  | "catgirl"
  | "pirate"
  | "shakespeare";
export type ImageAttachmentMode = "auto" | "text-only" | "disabled";
/** Reasoning-effort value accepted by the active model/provider. */
export type EffortLevel = string;

/** App-wide preferences that are not specific to chat, models, or looks. */
export interface GeneralSettings {
  /** UI language. "system" follows the OS/browser preference. */
  language: LanguagePreference;
  /** Whether the tray icon carries a colored activity dot. */
  trayStatus: boolean;
  /** Whether the app polls GitHub for a newer release in the background. */
  autoUpdateCheck: boolean;
}

export interface ModelSettings {
  defaultModelId: string;
  /** Provider-qualified model IDs shown in the composer picker. Null shows every model. */
  visibleModelIds: string[] | null;
  temperature: number;
  maxTokens: number;
  topP: number;
  /** Reasoning effort for models that support thinking (OpenAI/Anthropic). */
  effortLevel: EffortLevel;
  /** Whether to enable thinking/reasoning on models that support it. */
  thinkingEnabled: boolean;
}

export interface ChatSettings {
  autoSave: boolean;
  sendWith: SendShortcut;
  showTimestamps: boolean;
  codeTheme: CodeTheme;
  defaultSystemPrompt: string;
  /** Response personality appended to the system prompt. */
  personality: ChatPersonality;
  /** Timezone used for timestamps and shared with the model. */
  timezone: string;
  /** Maximum size in MB for local image previews and attachments loaded into memory. */
  maxPreviewSizeMb: number;
  /** Whether to show reasoning/thinking blocks when the provider returns them. */
  showReasoningBlocks: boolean;
  /** How image attachments are included in model context. */
  imageAttachmentMode: ImageAttachmentMode;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  fontSize: FontSize;
  sidebarPosition: SidebarPosition;
  rightPanelPosition: SidebarPosition;
  accentColor: AccentColorId;
  /** Hex color used when accentColor is "custom". */
  customAccent?: string;
  /** Full-app color theme preset. */
  themePreset: ThemePresetId;
  showAvatars: boolean;
  vibeHearts: boolean;
}

export interface SafetySettings {
  contentFilter: ContentFilterLevel;
  autoScanAttachments: boolean;
  rejectionStyle: RejectionStyle;
}

export interface MemorySettings {
  /** Number of most recent messages sent as context. */
  contextWindowLimit: number;
  memoryPersistence: boolean;
  /** Maximum memory bank size in kilobytes before pruning. */
  maxMemorySizeKb: number;
  /** Allowed memory categories. */
  memoryCategories: string[];
  /**
   * Markdown context files kept in sync with the bank so the terminal CLI
   * agents can read it. Empty disables the sync entirely.
   */
  agentContextFiles: string[];
}

export interface AdvancedSettings {
  developerMode: boolean;
  showRawResponses: boolean;
  customHeaders: Record<string, string>;
  logLevel: LogLevel;
  minimizeToTray: boolean;
  startMinimized: boolean;
  autoStartWithOs: boolean;
}

export interface NotificationSettings {
  desktopEnabled: boolean;
  /** Notify when the agent blocks on a tool approval. */
  approvalsEnabled: boolean;
  soundsEnabled: boolean;
  soundName: string;
  dndEnabled: boolean;
  /** "HH:MM" 24h */
  dndStart: string;
  dndEnd: string;
}

export interface HapticSettings {
  enabled: boolean;
  volume: number;
  /** Optional custom files, kept for the three sounds that had them. */
  clickSound: string;
  finishSound: string;
  errorSound: string;
  /** Sound families, each switchable on its own. See `soundCore.ts`. */
  interfaceSounds: boolean;
  messageSounds: boolean;
  alertSounds: boolean;
  activitySounds: boolean;
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ToolSettings {
  permission: ToolPermission;
  /** Whether file read/write/delete/rename tools are enabled. */
  fileToolsEnabled: boolean;
  /** Whether one-shot shell command execution is enabled. */
  shellToolsEnabled: boolean;
  tools: ToolConfig[];
}

export interface ArchiveSettings {
  /** Days of inactivity before auto-archive. 0 disables. */
  autoArchiveDays: number;
}

export interface AppSettings {
  general: GeneralSettings;
  model: ModelSettings;
  chat: ChatSettings;
  appearance: AppearanceSettings;
  safety: SafetySettings;
  memory: MemorySettings;
  advanced: AdvancedSettings;
  notifications: NotificationSettings;
  haptics: HapticSettings;
  tools: ToolSettings;
  archive: ArchiveSettings;
  /** action id -> binding string like "Mod+Shift+K" */
  shortcuts: Record<string, string>;
  /** Whether the first-run onboarding wizard has been completed. */
  onboardingCompleted: boolean;
}
