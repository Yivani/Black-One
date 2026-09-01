import type { AccentColorId, AppSettings, FontSize } from "@/types/settings";
import type { Provider } from "@/types/models";

export const APP_NAME = "Black One";
export const APP_TAGLINE = "The agent that grows with you.";
export const GITHUB_REPO_URL = "https://github.com/Yivani/Black-One";

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 48;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;
export const RIGHT_PANEL_DEFAULT_WIDTH = 288;
export const RIGHT_PANEL_MIN_WIDTH = 200;
export const RIGHT_PANEL_MAX_WIDTH = 480;
export const HEADER_HEIGHT = 48;
export const COMPOSER_MAX_LINES = 8;
export const MAX_QUEUE_SIZE = 20;
export const MAX_PINNED_SESSIONS = 10;
export const MAX_ATTACHMENTS = 10;
export const SEARCH_DEBOUNCE_MS = 200;
export const TRANSITION_MS = 150;
export const MESSAGE_VIRTUALIZATION_THRESHOLD = 50;
export const SESSION_TITLE_MAX_LENGTH = 50;
export const COMPOSER_PLACEHOLDER = "Describe what you need...";
export const STREAM_FLUSH_INTERVAL_MS = 32;

export const FONT_SIZE_SCALE: Record<FontSize, string> = {
  small: "13px",
  medium: "14px",
  large: "16px",
};

export interface AccentPreset {
  id: AccentColorId;
  label: string;
  /** HSL channels applied to --primary / --ring. */
  light: string;
  dark: string;
}

export const ACCENT_COLORS: AccentPreset[] = [
  { id: "neutral", label: "Ink", light: "240 5.9% 10%", dark: "0 0% 98%" },
  {
    id: "blue",
    label: "Slate Blue",
    light: "215 55% 48%",
    dark: "215 70% 68%",
  },
  { id: "indigo", label: "Indigo", light: "235 55% 55%", dark: "235 70% 70%" },
  { id: "violet", label: "Iris", light: "262 45% 52%", dark: "262 60% 70%" },
  { id: "pink", label: "Pink", light: "330 65% 55%", dark: "330 75% 70%" },
  { id: "red", label: "Crimson", light: "0 72% 51%", dark: "0 80% 65%" },
  { id: "orange", label: "Orange", light: "24 85% 48%", dark: "24 90% 60%" },
  { id: "amber", label: "Ochre", light: "32 75% 42%", dark: "38 80% 60%" },
  { id: "green", label: "Moss", light: "152 45% 36%", dark: "152 50% 58%" },
  { id: "teal", label: "Teal", light: "175 55% 38%", dark: "175 65% 55%" },
  { id: "cyan", label: "Cyan", light: "190 80% 38%", dark: "190 85% 55%" },
  { id: "rose", label: "Rose", light: "346 75% 54%", dark: "346 80% 67%" },
  { id: "sky", label: "Sky", light: "199 89% 43%", dark: "199 90% 62%" },
];

export const NOTIFICATION_SOUNDS = ["chime", "pop", "ding"] as const;

export interface ShortcutDefinition {
  id: string;
  label: string;
  defaultBinding: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "quick-chat",
    label: "Toggle Quick Chat",
    defaultBinding: "Mod+Shift+Space",
  },
  { id: "toggle-sidebar", label: "Toggle sidebar", defaultBinding: "Mod+B" },
  {
    id: "toggle-right-sidebar",
    label: "Toggle right sidebar",
    defaultBinding: "Mod+Shift+B",
  },
  { id: "open-settings", label: "Open settings", defaultBinding: "Mod+," },
  {
    id: "command-palette",
    label: "Command palette",
    defaultBinding: "Mod+K",
  },
  {
    id: "toggle-dark-mode",
    label: "Toggle dark mode",
    defaultBinding: "Mod+Shift+D",
  },
  {
    id: "zen-mode",
    label: "Hide sidebar (Zen mode)",
    defaultBinding: "Mod+Alt+H",
  },
  { id: "new-terminal", label: "New terminal", defaultBinding: "Mod+Shift+T" },
];

export function defaultShortcutMap(): Record<string, string> {
  return Object.fromEntries(
    SHORTCUT_DEFINITIONS.map((s) => [s.id, s.defaultBinding]),
  );
}

function mp(inputPrice: number, outputPrice: number, currency = "USD") {
  return { inputPrice, outputPrice, currency };
}

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI (Codex)",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiMode: "responses",
    isEnabled: false,
    hasApiKey: false,
    models: [
      {
        id: "gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        providerId: "openai",
        contextWindow: 1_050_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "Flagship OpenAI model for complex reasoning and coding.",
        pricing: mp(3, 12),
      },
      {
        id: "gpt-5.6-terra",
        name: "GPT-5.6 Terra",
        providerId: "openai",
        contextWindow: 1_050_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "Balanced intelligence and cost for coding work.",
        pricing: mp(2, 8),
      },
      {
        id: "gpt-5.6-luna",
        name: "GPT-5.6 Luna",
        providerId: "openai",
        contextWindow: 1_050_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "Fast, cost-sensitive OpenAI model.",
        pricing: mp(1, 4),
      },
      {
        id: "gpt-5.3-codex",
        name: "GPT-5.3 Codex",
        providerId: "openai",
        contextWindow: 400_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description:
          "Agentic coding model available through the Responses API.",
        pricing: mp(1.5, 6),
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com",
    apiMode: "anthropic-messages",
    isEnabled: false,
    hasApiKey: false,
    models: [
      {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        providerId: "anthropic",
        contextWindow: 200_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "Balanced performance and speed.",
        pricing: mp(3, 15),
      },
      {
        id: "claude-opus-5",
        name: "Claude Opus 5",
        providerId: "anthropic",
        contextWindow: 200_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "Highest capability for complex tasks.",
        pricing: mp(15, 75),
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        providerId: "anthropic",
        contextWindow: 200_000,
        capabilities: ["vision", "tools", "streaming"],
        description: "Fastest Claude model.",
        pricing: mp(0.8, 4),
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    type: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    apiMode: "chat-completions",
    isEnabled: false,
    hasApiKey: false,
    models: [
      {
        id: "openrouter/auto",
        name: "OpenRouter Auto",
        providerId: "openrouter",
        contextWindow: 2_000_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "Automatically routes to an appropriate available model.",
        pricing: mp(2, 8),
      },
      {
        id: "openai/gpt-5.6-sol",
        name: "OpenAI: GPT-5.6 Sol",
        providerId: "openrouter",
        contextWindow: 1_050_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        pricing: mp(3, 12),
      },
      {
        id: "anthropic/claude-sonnet-5",
        name: "Anthropic: Claude Sonnet 5",
        providerId: "openrouter",
        contextWindow: 1_000_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        pricing: mp(3, 15),
      },
      {
        id: "x-ai/grok-4.6",
        name: "xAI: Grok 4.6",
        providerId: "openrouter",
        contextWindow: 500_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        pricing: mp(3, 10),
      },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    type: "openai",
    baseUrl: "https://api.x.ai/v1",
    apiMode: "chat-completions",
    isEnabled: false,
    hasApiKey: false,
    models: [
      {
        id: "grok-4.6",
        name: "Grok 4.6",
        providerId: "xai",
        contextWindow: 500_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        description: "xAI flagship reasoning model.",
        pricing: mp(3, 10),
      },
    ],
  },
  {
    id: "opencode",
    name: "OpenCode Zen",
    type: "openai",
    baseUrl: "https://opencode.ai/zen/v1",
    apiMode: "chat-completions",
    isEnabled: false,
    hasApiKey: false,
    models: [
      {
        id: "gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        providerId: "opencode",
        contextWindow: 1_050_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        apiMode: "responses",
        pricing: mp(2.5, 10),
      },
      {
        id: "gpt-5.6-terra",
        name: "GPT-5.6 Terra",
        providerId: "opencode",
        contextWindow: 1_050_000,
        capabilities: ["vision", "tools", "reasoning", "streaming"],
        apiMode: "responses",
        pricing: mp(2, 8),
      },
      {
        id: "kimi-k3",
        name: "Kimi K3",
        providerId: "opencode",
        contextWindow: 1_048_576,
        capabilities: ["tools", "reasoning", "streaming"],
        pricing: mp(0.5, 2),
      },
      {
        id: "big-pickle",
        name: "Big Pickle",
        providerId: "opencode",
        contextWindow: 200_000,
        capabilities: ["tools", "streaming"],
        pricing: mp(0.3, 1.2),
      },
    ],
  },
  {
    id: "kimi",
    name: "Kimi (Moonshot)",
    type: "openai",
    baseUrl: "https://api.moonshot.ai/v1",
    apiMode: "chat-completions",
    isEnabled: false,
    hasApiKey: false,
    plan: "default",
    plans: ["default", "pro", "ultra"],
    models: [
      {
        id: "kimi-k3",
        name: "Kimi K3",
        providerId: "kimi",
        contextWindow: 1_048_576,
        capabilities: ["tools", "streaming"],
        description: "Moonshot Kimi K3 flagship with 1M context and tool use.",
        pricing: mp(0.5, 2),
      },
      {
        id: "kimi-k2.6",
        name: "Kimi K2.6",
        providerId: "kimi",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description: "Moonshot Kimi K2.6 general model.",
        pricing: mp(0.3, 1.2),
      },
      {
        id: "kimi-k2.7-code",
        name: "Kimi K2.7 Code",
        providerId: "kimi",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description: "Moonshot Kimi K2.7 optimized for coding agents.",
        pricing: mp(0.4, 1.6),
      },
      {
        id: "kimi-k2.7-code-highspeed",
        name: "Kimi K2.7 Code HighSpeed",
        providerId: "kimi",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description: "High-speed Moonshot Kimi K2.7 coding model.",
        pricing: mp(0.6, 2.4),
      },
      {
        id: "kimi-k2.5",
        name: "Kimi K2.5",
        providerId: "kimi",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description: "Moonshot Kimi K2.5 with long context and tool use.",
        pricing: mp(0.3, 1.2),
      },
    ],
  },
  {
    id: "kimi-code",
    name: "Kimi Code",
    type: "openai",
    baseUrl: "https://api.kimi.com/coding/v1",
    apiMode: "chat-completions",
    isEnabled: false,
    hasApiKey: false,
    models: [
      {
        id: "k3",
        name: "Kimi K3",
        providerId: "kimi-code",
        contextWindow: 1_048_576,
        capabilities: ["tools", "streaming"],
        description: "Kimi K3 flagship coding model with up to 1M context.",
        pricing: mp(0.5, 2),
      },
      {
        id: "k3-256k",
        name: "Kimi K3 (256k)",
        providerId: "kimi-code",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description: "Kimi K3 256k context variant.",
        pricing: mp(0.5, 2),
      },
      {
        id: "kimi-for-coding",
        name: "Kimi K2.7 Code",
        providerId: "kimi-code",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description:
          "Kimi K2.7 Code for code completion and routine development.",
        pricing: mp(0.4, 1.6),
      },
      {
        id: "kimi-for-coding-highspeed",
        name: "Kimi K2.7 Code HighSpeed",
        providerId: "kimi-code",
        contextWindow: 256_000,
        capabilities: ["tools", "streaming"],
        description: "High-speed K2.7 Code variant (~5–6× faster output).",
        pricing: mp(0.6, 2.4),
      },
    ],
  },
  {
    id: "local",
    name: "Local",
    type: "local",
    baseUrl: "http://localhost:11434/v1",
    apiMode: "chat-completions",
    isEnabled: false,
    hasApiKey: false,
    models: [],
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: "system",
    trayStatus: true,
    autoUpdateCheck: true,
  },
  model: {
    defaultModelId: "",
    visibleModelIds: null,
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    effortLevel: "medium",
    thinkingEnabled: true,
  },
  chat: {
    autoSave: true,
    sendWith: "enter",
    showTimestamps: true,
    codeTheme: "auto",
    defaultSystemPrompt: "",
    personality: "none",
    timezone: "",
    maxPreviewSizeMb: 16,
    showReasoningBlocks: true,
    imageAttachmentMode: "auto",
  },
  appearance: {
    theme: "system",
    fontSize: "medium",
    sidebarPosition: "left",
    rightPanelPosition: "left",
    accentColor: "neutral",
    customAccent: "#6366f1",
    themePreset: "default",
    showAvatars: false,
    vibeHearts: true,
  },
  safety: {
    contentFilter: "moderate",
    autoScanAttachments: true,
    rejectionStyle: "brief",
  },
  memory: {
    contextWindowLimit: 50,
    memoryPersistence: true,
    maxMemorySizeKb: 256,
    memoryCategories: [
      "personal",
      "work",
      "hobbies",
      "projects",
      "preferences",
      "writing_style",
      "goals",
      "relationships",
      // Filled by watching the terminal rather than by conversation.
      "commands",
      "toolchain",
      "environment",
      "conventions",
      "other",
    ],
    // Every context file a supported agent reads. Leaving one off means that
    // agent silently remembers nothing, which is how Gemini CLI was missed.
    // Littering is not a risk: a file is only ever created once the bank has
    // something in it, and only the region between our markers is written.
    agentContextFiles: ["AGENTS.md", "CLAUDE.md", "GEMINI.md"],
  },
  advanced: {
    developerMode: false,
    showRawResponses: false,
    customHeaders: {},
    logLevel: "info",
    minimizeToTray: true,
    startMinimized: false,
    autoStartWithOs: false,
  },
  notifications: {
    desktopEnabled: true,
    approvalsEnabled: true,
    soundsEnabled: false,
    soundName: "chime",
    dndEnabled: false,
    dndStart: "22:00",
    dndEnd: "08:00",
  },
  haptics: {
    enabled: true,
    volume: 0.2,
    clickSound: "default",
    finishSound: "default",
    errorSound: "default",
    // Everything on by default: the sounds are quiet and short enough that
    // the honest default is to let someone hear the set and switch off what
    // they do not want, rather than hide it behind a setting nobody finds.
    interfaceSounds: true,
    messageSounds: true,
    alertSounds: true,
    activitySounds: true,
  },
  tools: {
    permission: "auto",
    fileToolsEnabled: true,
    shellToolsEnabled: true,
    tools: [],
  },
  archive: {
    autoArchiveDays: 0,
  },
  shortcuts: defaultShortcutMap(),
  onboardingCompleted: false,
};
