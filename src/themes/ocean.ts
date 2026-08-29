import { ThemePreset } from "@/lib/themes";

/**
 * Ocean-inspired full-app color theme preset.
 *
 * Light mode uses a soft sea-surface palette with a deep navy foreground for
 * readable contrast. Dark mode dives into a deep-ocean navy with bright cyan
 * accents.
 */
export const oceanTheme: ThemePreset = {
  id: "ocean",
  label: "Ocean",
  description: "A calm, ocean-inspired palette with clear contrast.",
  light: {
    "--background": "195 35% 96%",
    "--foreground": "210 45% 12%",
    "--card": "195 30% 99%",
    "--card-foreground": "210 45% 12%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "210 45% 12%",
    "--primary": "200 85% 34%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "200 35% 92%",
    "--secondary-foreground": "210 45% 15%",
    "--muted": "200 30% 94%",
    "--muted-foreground": "210 25% 35%",
    "--accent": "190 75% 42%",
    "--accent-foreground": "210 55% 10%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "200 25% 86%",
    "--input": "200 25% 90%",
    "--ring": "200 85% 34%",
  },
  dark: {
    "--background": "220 35% 7%",
    "--foreground": "210 30% 96%",
    "--card": "220 30% 10%",
    "--card-foreground": "210 30% 96%",
    "--popover": "220 30% 11%",
    "--popover-foreground": "210 30% 96%",
    "--primary": "190 90% 55%",
    "--primary-foreground": "220 40% 10%",
    "--secondary": "220 25% 17%",
    "--secondary-foreground": "210 30% 96%",
    "--muted": "220 25% 15%",
    "--muted-foreground": "210 20% 60%",
    "--accent": "175 70% 45%",
    "--accent-foreground": "220 40% 10%",
    "--destructive": "0 72% 55%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "220 20% 20%",
    "--input": "220 20% 23%",
    "--ring": "190 90% 55%",
  },
};
