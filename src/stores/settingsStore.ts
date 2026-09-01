import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  AppSettings,
  LegacyToolPermission,
  ToolPermission,
} from "@/types/settings";
import { isLegacyContextFileDefault } from "@/lib/agentContext";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { persistence } from "@/lib/persistence";
import { debounce } from "@/lib/utils";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";

const SETTINGS_KEY = "app:settings";

const LEGACY_PERMISSIONS: Record<LegacyToolPermission, ToolPermission> = {
  ask: "manual",
  allowlisted: "auto",
};

const TOOL_PERMISSIONS: ToolPermission[] = [
  "manual",
  "auto",
  "yolo",
  "blocked",
];

/** Upgrades settings written before the two permission vocabularies merged. */
function migrateToolPermission(value: unknown): ToolPermission {
  if (typeof value !== "string") return DEFAULT_SETTINGS.tools.permission;
  if (value in LEGACY_PERMISSIONS) {
    return LEGACY_PERMISSIONS[value as LegacyToolPermission];
  }
  if ((TOOL_PERMISSIONS as string[]).includes(value)) {
    return value as ToolPermission;
  }
  return DEFAULT_SETTINGS.tools.permission;
}

/** Settings own the permission; the runtime store mirrors it. */
function syncToolPermission(permission: ToolPermission): void {
  const runtime = useToolRuntimeStore.getState();
  if (runtime.permissionMode !== permission) {
    runtime.setPermissionMode(permission);
  }
}

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  load: () => Promise<void>;
  updateSection: <K extends keyof AppSettings>(
    section: K,
    patch: Partial<AppSettings[K]>,
  ) => void;
  /**
   * The one way to change tool permission. Writes the setting and mirrors it
   * to the runtime store, so every mode — YOLO included — survives a reload.
   */
  setToolPermission: (permission: ToolPermission) => void;
  setShortcut: (actionId: string, binding: string) => void;
  resetShortcuts: () => void;
  resetAll: () => Promise<void>;
}

const persistSettings = debounce((settings: AppSettings) => {
  void persistence.setSetting(SETTINGS_KEY, JSON.stringify(settings));
}, 300);

function mergeWithDefaults(stored: Partial<AppSettings>): AppSettings {
  const merged: Record<string, unknown> = {};
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  const incoming = stored as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    const fallback = defaults[key];
    const value = incoming[key];
    if (value === undefined || value === null) {
      merged[key] = fallback;
    } else if (typeof fallback === "object" && !Array.isArray(fallback) && typeof value === "object") {
      merged[key] = { ...(fallback as object), ...(value as object) };
    } else {
      merged[key] = value;
    }
  }
  return merged as unknown as AppSettings;
}

export const useSettingsStore = create<SettingsState>()(
  immer((set, get) => ({
    settings: DEFAULT_SETTINGS,
    isLoaded: false,

    load: async () => {
      try {
        const raw = await persistence.getSetting(SETTINGS_KEY);
        const stored = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};

        // One-time migration from the legacy localStorage haptics mute flag.
        if (stored.haptics === undefined) {
          try {
            const legacyRaw = window.localStorage.getItem("ui:hapticsMuted");
            if (legacyRaw !== null) {
              const legacyMuted = JSON.parse(legacyRaw) as boolean;
              stored.haptics = {
                ...DEFAULT_SETTINGS.haptics,
                enabled: !legacyMuted,
              };
              window.localStorage.removeItem("ui:hapticsMuted");
            }
          } catch {
            // Ignore malformed legacy value.
          }
        }

        const merged = mergeWithDefaults(stored);
        merged.tools.permission = migrateToolPermission(
          merged.tools.permission,
        );

        // Memory categories are stored as a list, so a release that adds one
        // would leave existing installs with it switched off — and their
        // terminal-learned facts silently filtered out of every prompt.
        const knownCategories = new Set(merged.memory.memoryCategories);
        merged.memory.memoryCategories = [
          ...merged.memory.memoryCategories,
          ...DEFAULT_SETTINGS.memory.memoryCategories.filter(
            (category) => !knownCategories.has(category),
          ),
        ];

        // Same trap, one release later: GEMINI.md shipped switched off, so
        // every existing install would keep writing memory for Claude and
        // Codex while Gemini CLI read nothing. Only a list that still matches
        // that old default is upgraded — a list the user has actually touched
        // is theirs.
        if (isLegacyContextFileDefault(merged.memory.agentContextFiles)) {
          merged.memory.agentContextFiles = [
            ...DEFAULT_SETTINGS.memory.agentContextFiles,
          ];
        }

        // Existing installs (any stored settings at all) should not be forced
        // through the first-run onboarding wizard.
        if (Object.keys(stored).length > 0) {
          merged.onboardingCompleted = true;
        }

        set((state) => {
          state.settings = merged;
          state.isLoaded = true;
        });
        syncToolPermission(merged.tools.permission);
      } catch {
        set((state) => {
          state.settings = DEFAULT_SETTINGS;
          state.isLoaded = true;
        });
        syncToolPermission(DEFAULT_SETTINGS.tools.permission);
      }
    },

    updateSection: (section, patch) => {
      set((state) => {
        const current = state.settings[section];
        if (
          typeof current !== "object" ||
          current === null ||
          Array.isArray(current)
        ) {
          // Top-level primitive fields (e.g. onboardingCompleted) cannot be
          // Object.assign-ed; replace them directly.
          state.settings[section] = patch as AppSettings[typeof section];
        } else {
          Object.assign(current, patch);
        }
      });
      if (section === "tools" && "permission" in patch) {
        syncToolPermission(get().settings.tools.permission);
      }
      persistSettings(get().settings);
    },

    setToolPermission: (permission) => {
      set((state) => {
        state.settings.tools.permission = permission;
      });
      syncToolPermission(permission);
      persistSettings(get().settings);
    },

    setShortcut: (actionId, binding) => {
      set((state) => {
        state.settings.shortcuts[actionId] = binding;
      });
      persistSettings(get().settings);
    },

    resetShortcuts: () => {
      set((state) => {
        state.settings.shortcuts = DEFAULT_SETTINGS.shortcuts;
      });
      persistSettings(get().settings);
    },

    resetAll: async () => {
      set((state) => {
        state.settings = DEFAULT_SETTINGS;
      });
      // The runtime store mirrors this setting; without the sync a reset would
      // leave the previous tool permission in force.
      syncToolPermission(DEFAULT_SETTINGS.tools.permission);
      await persistence.setSetting(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    },
  })),
);
