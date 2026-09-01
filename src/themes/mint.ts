import type { ThemePreset } from "@/lib/themes";

/**
 * Mint theme preset for Black One.
 *
 * A crisp, refreshing teal-and-mint palette. Light mode uses a cool mint
 * cream; dark mode dives into deep teal water with bright mint highlights.
 */
export const mintTheme: ThemePreset = {
  id: "mint",
  label: "Mint",
  description: "Cool teal, mint cream, and fresh aquatic accents.",
  light: {
    "--background": "160 30% 97%",
    "--foreground": "170 25% 12%",
    "--card": "160 25% 98%",
    "--card-foreground": "170 25% 12%",
    "--popover": "160 30% 99%",
    "--popover-foreground": "170 25% 12%",
    "--primary": "170 70% 30%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "160 22% 92%",
    "--secondary-foreground": "170 25% 15%",
    "--muted": "160 18% 93%",
    "--muted-foreground": "170 15% 38%",
    "--accent": "155 65% 50%",
    "--accent-foreground": "170 35% 10%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "160 15% 86%",
    "--input": "160 15% 84%",
    "--ring": "170 70% 35%",
  },
  dark: {
    "--background": "170 25% 7%",
    "--foreground": "160 25% 96%",
    "--card": "170 22% 9%",
    "--card-foreground": "160 25% 96%",
    "--popover": "170 22% 10%",
    "--popover-foreground": "160 25% 96%",
    "--primary": "160 70% 55%",
    "--primary-foreground": "170 30% 10%",
    "--secondary": "170 15% 15%",
    "--secondary-foreground": "160 25% 96%",
    "--muted": "170 12% 14%",
    "--muted-foreground": "160 15% 60%",
    "--accent": "155 65% 45%",
    "--accent-foreground": "170 35% 10%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "170 12% 20%",
    "--input": "170 12% 23%",
    "--ring": "160 70% 55%",
  },
};
