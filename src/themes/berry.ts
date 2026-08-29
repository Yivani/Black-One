import { ThemePreset } from "@/lib/themes";

/**
 * Berry theme preset for Black One.
 *
 * A vibrant violet-and-raspberry palette. Light mode feels like soft lavender
 * paper; dark mode sinks into rich aubergine with glowing magenta accents.
 */
export const berryTheme: ThemePreset = {
  id: "berry",
  label: "Berry",
  description: "Lavender, violet, and raspberry tones.",
  light: {
    "--background": "280 25% 97%",
    "--foreground": "270 30% 12%",
    "--card": "280 20% 98%",
    "--card-foreground": "270 30% 12%",
    "--popover": "280 25% 99%",
    "--popover-foreground": "270 30% 12%",
    "--primary": "270 65% 48%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "280 20% 92%",
    "--secondary-foreground": "270 25% 15%",
    "--muted": "280 18% 93%",
    "--muted-foreground": "270 15% 38%",
    "--accent": "320 75% 55%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "280 15% 86%",
    "--input": "280 15% 89%",
    "--ring": "270 65% 48%",
  },
  dark: {
    "--background": "270 25% 8%",
    "--foreground": "280 25% 96%",
    "--card": "270 22% 10%",
    "--card-foreground": "280 25% 96%",
    "--popover": "270 22% 11%",
    "--popover-foreground": "280 25% 96%",
    "--primary": "280 75% 65%",
    "--primary-foreground": "270 30% 10%",
    "--secondary": "270 15% 16%",
    "--secondary-foreground": "280 25% 96%",
    "--muted": "270 12% 15%",
    "--muted-foreground": "280 15% 62%",
    "--accent": "320 70% 58%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "270 12% 20%",
    "--input": "270 12% 23%",
    "--ring": "280 75% 65%",
  },
};
