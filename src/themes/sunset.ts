import type { ThemePreset } from "@/lib/themes";

/**
 * Sunset theme preset for Black One.
 *
 * Warm coral, amber, and soft pink. Light mode is a sun-bleached cream;
 * dark mode is a deep wine dusk with bright coral highlights.
 */
export const sunsetTheme: ThemePreset = {
  id: "sunset",
  label: "Sunset",
  description: "Coral, amber, and warm dusk tones.",
  light: {
    "--background": "25 30% 97%",
    "--foreground": "15 25% 15%",
    "--card": "25 25% 98%",
    "--card-foreground": "15 25% 15%",
    "--popover": "25 30% 99%",
    "--popover-foreground": "15 25% 15%",
    "--primary": "350 75% 51.5%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "25 22% 92%",
    "--secondary-foreground": "15 25% 15%",
    "--muted": "25 18% 93%",
    "--muted-foreground": "15 15% 40%",
    "--accent": "25 90% 58%",
    "--accent-foreground": "15 30% 10%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "25 15% 86%",
    "--input": "25 15% 85%",
    "--ring": "350 75% 55%",
  },
  dark: {
    "--background": "340 20% 8%",
    "--foreground": "25 25% 96%",
    "--card": "340 18% 10%",
    "--card-foreground": "25 25% 96%",
    "--popover": "340 18% 11%",
    "--popover-foreground": "25 25% 96%",
    "--primary": "350 80% 62%",
    "--primary-foreground": "340 30% 10%",
    "--secondary": "340 12% 16%",
    "--secondary-foreground": "25 25% 96%",
    "--muted": "340 10% 15%",
    "--muted-foreground": "25 15% 60%",
    "--accent": "25 85% 55%",
    "--accent-foreground": "340 30% 10%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "340 10% 20%",
    "--input": "340 10% 23%",
    "--ring": "350 80% 62%",
  },
};
