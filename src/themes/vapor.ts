import type { ThemePreset } from "@/lib/themes";

/**
 * Vapor theme preset for Black One.
 *
 * Synthwave: hot magenta against electric cyan on a violet-black. The light
 * mode is the same two hues taken down to a readable strength rather than a
 * different idea.
 */
export const vaporTheme: ThemePreset = {
  id: "vapor",
  label: "Vapor",
  description: "Synthwave magenta and cyan over violet dusk.",
  light: {
    "--background": "285 35% 97%",
    "--foreground": "280 40% 15%",
    "--card": "285 30% 99%",
    "--card-foreground": "280 40% 15%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "280 40% 15%",
    "--primary": "300 60% 40%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "285 28% 92%",
    "--secondary-foreground": "280 40% 18%",
    "--muted": "285 25% 93%",
    "--muted-foreground": "282 18% 38%",
    "--accent": "190 75% 32%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 70% 45%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "285 22% 86%",
    "--input": "285 22% 86%",
    "--ring": "300 60% 40%",
  },
  dark: {
    "--background": "275 45% 7%",
    "--foreground": "290 25% 95%",
    "--card": "275 40% 10%",
    "--card-foreground": "290 25% 95%",
    "--popover": "275 40% 11%",
    "--popover-foreground": "290 25% 95%",
    "--primary": "315 90% 68%",
    "--primary-foreground": "275 50% 8%",
    "--secondary": "275 30% 18%",
    "--secondary-foreground": "290 25% 95%",
    "--muted": "275 30% 16%",
    "--muted-foreground": "288 20% 68%",
    "--accent": "185 85% 60%",
    "--accent-foreground": "275 50% 8%",
    "--destructive": "0 70% 52%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "275 28% 23%",
    "--input": "275 28% 25%",
    "--ring": "315 90% 68%",
  },
};
