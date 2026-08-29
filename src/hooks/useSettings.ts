import type { AppSettings } from "@/types/settings";
import { useSettingsStore } from "@/stores/settingsStore";

export interface UseSettingsResult {
  settings: AppSettings;
  isLoaded: boolean;
  updateSection: <K extends keyof AppSettings>(
    section: K,
    patch: Partial<AppSettings[K]>,
  ) => void;
  setShortcut: (actionId: string, binding: string) => void;
  resetShortcuts: () => void;
}

export function useSettings(): UseSettingsResult {
  const settings = useSettingsStore((s) => s.settings);
  const isLoaded = useSettingsStore((s) => s.isLoaded);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const setShortcut = useSettingsStore((s) => s.setShortcut);
  const resetShortcuts = useSettingsStore((s) => s.resetShortcuts);
  return { settings, isLoaded, updateSection, setShortcut, resetShortcuts };
}
