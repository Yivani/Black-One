import type { ThemePreset } from "@/lib/themes";

/**
 * Amber theme preset for Black One.
 *
 * Warm amber and tangerine accents on a soft sand background in light mode,
 * or a dark espresso background in dark mode. Great for late-night sessions.
 */
export const amberTheme: ThemePreset = {
  id: "amber",
  label: "Amber",
  description: "Warm amber and tangerine on sand or espresso.",
  light: {
    "--background": "35 40% 96%",
    "--foreground": "30 30% 12%",
    "--card": "35 35% 98%",
    "--card-foreground": "30 30% 12%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "30 30% 12%",
    "--primary": "30 90% 45%",
    "--primary-foreground": "0 0% 15%",
    "--secondary": "35 30% 91%",
    "--secondary-foreground": "30 30% 12%",
    "--muted": "35 28% 92%",
    "--muted-foreground": "30 20% 40%",
    "--accent": "20 85% 50%",
    "--accent-foreground": "0 0% 13%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "35 25% 85%",
    "--input": "35 25% 83.5%",
    "--ring": "30 90% 45%",
  },
  dark: {
    "--background": "25 25% 8%",
    "--foreground": "35 30% 94%",
    "--card": "25 22% 10%",
    "--card-foreground": "35 30% 94%",
    "--popover": "25 22% 9%",
    "--popover-foreground": "35 30% 94%",
    "--primary": "35 90% 55%",
    "--primary-foreground": "25 25% 8%",
    "--secondary": "25 18% 15%",
    "--secondary-foreground": "35 30% 94%",
    "--muted": "25 15% 14%",
    "--muted-foreground": "35 18% 60%",
    "--accent": "25 85% 55%",
    "--accent-foreground": "25 25% 8%",
    "--destructive": "0 72% 52.5%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "25 18% 20%",
    "--input": "25 18% 18%",
    "--ring": "35 90% 55%",
  },
};
