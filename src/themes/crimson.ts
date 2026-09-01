import type { ThemePreset } from "@/lib/themes";

/**
 * Crimson theme preset for Black One.
 *
 * Burgundy rather than the coral of Sunset or the pink of Sakura. The
 * destructive colour is pushed towards orange-red so a delete button is still
 * distinguishable from the theme's own crimson.
 */
export const crimsonTheme: ThemePreset = {
  id: "crimson",
  label: "Crimson",
  description: "Burgundy and deep red over warm off-white.",
  light: {
    "--background": "350 25% 97%",
    "--foreground": "350 30% 14%",
    "--card": "350 20% 99%",
    "--card-foreground": "350 30% 14%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "350 30% 14%",
    "--primary": "350 65% 38%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "350 20% 92%",
    "--secondary-foreground": "350 30% 18%",
    "--muted": "350 18% 93%",
    "--muted-foreground": "350 12% 38%",
    "--accent": "345 60% 42%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "15 75% 40%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "350 18% 85%",
    "--input": "350 18% 85%",
    "--ring": "350 65% 38%",
  },
  dark: {
    "--background": "350 25% 7%",
    "--foreground": "350 15% 95%",
    "--card": "350 22% 10%",
    "--card-foreground": "350 15% 95%",
    "--popover": "350 22% 11%",
    "--popover-foreground": "350 15% 95%",
    "--primary": "350 75% 62%",
    "--primary-foreground": "350 40% 10%",
    "--secondary": "350 18% 17%",
    "--secondary-foreground": "350 15% 95%",
    "--muted": "350 18% 15%",
    "--muted-foreground": "350 12% 65%",
    "--accent": "12 75% 58%",
    "--accent-foreground": "350 40% 10%",
    "--destructive": "0 70% 50%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "350 16% 22%",
    "--input": "350 16% 24%",
    "--ring": "350 75% 62%",
  },
};
