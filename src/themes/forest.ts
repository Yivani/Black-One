import { ThemePreset } from "@/lib/themes";

/**
 * Forest theme preset for Black One.
 *
 * A calm, mossy palette with sage creams in light mode and deep evergreen
 * shadows in dark mode. Accents shift from forest green to bright mint.
 */
export const forestTheme: ThemePreset = {
  id: "forest",
  label: "Forest",
  description: "Sage, moss, and deep evergreen tones.",
  light: {
    "--background": "120 20% 97%",
    "--foreground": "120 25% 12%",
    "--card": "120 18% 98%",
    "--card-foreground": "120 25% 12%",
    "--popover": "120 20% 99%",
    "--popover-foreground": "120 25% 12%",
    "--primary": "145 60% 35%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "120 18% 92%",
    "--secondary-foreground": "120 25% 15%",
    "--muted": "120 15% 93%",
    "--muted-foreground": "120 15% 35%",
    "--accent": "150 55% 45%",
    "--accent-foreground": "120 30% 10%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "120 15% 86%",
    "--input": "120 15% 89%",
    "--ring": "145 60% 35%",
  },
  dark: {
    "--background": "145 20% 7%",
    "--foreground": "120 20% 96%",
    "--card": "145 18% 9%",
    "--card-foreground": "120 20% 96%",
    "--popover": "145 18% 10%",
    "--popover-foreground": "120 20% 96%",
    "--primary": "150 65% 55%",
    "--primary-foreground": "145 30% 10%",
    "--secondary": "145 15% 16%",
    "--secondary-foreground": "120 20% 96%",
    "--muted": "145 12% 14%",
    "--muted-foreground": "120 15% 60%",
    "--accent": "145 60% 45%",
    "--accent-foreground": "120 30% 10%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "145 12% 20%",
    "--input": "145 12% 23%",
    "--ring": "150 65% 55%",
  },
};
