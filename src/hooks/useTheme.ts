import { useEffect, useState } from "react";
import { ACCENT_COLORS, FONT_SIZE_SCALE } from "@/lib/constants";
import { readableForeground } from "@/lib/contrast";
import { THEME_PRESETS } from "@/lib/themes";
import { accentChannelsFromHex } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

export function useTheme(): void {
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const isLoaded = useSettingsStore((s) => s.isLoaded);

  useEffect(() => {
    if (!isLoaded) return;
    const root = document.documentElement;

    const applyTheme = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = appearance.theme === "dark" || (appearance.theme === "system" && prefersDark);
      root.classList.toggle("dark", dark);
      return dark;
    };

    const dark = applyTheme();
    root.style.fontSize = FONT_SIZE_SCALE[appearance.fontSize];

    const preset =
      THEME_PRESETS.find((t) => t.id === appearance.themePreset) ?? THEME_PRESETS[0];
    const overrides = dark ? preset.dark : preset.light;
    for (const [key, value] of Object.entries(overrides)) {
      root.style.setProperty(key, value);
    }

    let accentChannels: string;
    if (appearance.accentColor === "custom" && appearance.customAccent) {
      const custom = accentChannelsFromHex(appearance.customAccent);
      accentChannels = dark ? (custom?.dark ?? ACCENT_COLORS[0].dark) : (custom?.light ?? ACCENT_COLORS[0].light);
    } else {
      const accent = ACCENT_COLORS.find((c) => c.id === appearance.accentColor) ?? ACCENT_COLORS[0];
      accentChannels = dark ? accent.dark : accent.light;
    }
    root.style.setProperty("--primary", accentChannels);
    root.style.setProperty("--ring", accentChannels);
    // The accent replaces the preset's --primary, so the label colour the
    // preset shipped no longer belongs to the colour underneath it. Derive it
    // instead, and a white-on-lime button becomes impossible whatever the user
    // picks — custom hex included.
    root.style.setProperty("--primary-foreground", readableForeground(accentChannels));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [appearance.theme, appearance.fontSize, appearance.accentColor, appearance.themePreset, isLoaded]);
}

export function useResolvedDark(): boolean {
  const theme = useSettingsStore((s) => s.settings.appearance.theme);
  const [dark, setDark] = useState(() => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const compute = () => {
      if (theme === "dark") return true;
      if (theme === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    setDark(compute());
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setDark(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  return dark;
}

export function toggleDarkMode(): void {
  const { settings, updateSection } = useSettingsStore.getState();
  const current = settings.appearance.theme;
  const resolvedDark =
    current === "dark" ||
    (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  updateSection("appearance", { theme: resolvedDark ? "light" : "dark" });
}
