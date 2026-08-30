import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AppSettings } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { persistence } from "@/lib/persistence";
import { debounce } from "@/lib/utils";
import { useToolRuntimeStore } from "@/stores/toolRuntimeStore";

const SETTINGS_KEY = "app:settings";

function syncToolPermission(permission: AppSettings["tools"]["permission"]): void {
  const map: Record<typeof permission, ReturnType<typeof useToolRuntimeStore.getState>["permissionMode"]> = {
    ask: "manual",
    allowlisted: "auto",
    blocked: "manual",
  };
  useToolRuntimeStore.getState().setPermissionMode(map[permission]);
}

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  load: () => Promise<void>;
  updateSection: <K extends keyof AppSettings>(
    section: K,
    patch: Partial<AppSettings[K]>,
  ) => void;
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
        Object.assign(state.settings[section], patch);
      });
      if (section === "tools" && "permission" in patch) {
        syncToolPermission(get().settings.tools.permission);
      }
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
      await persistence.setSetting(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    },
  })),
);
