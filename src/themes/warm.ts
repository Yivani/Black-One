import type { ThemePreset } from "@/lib/themes";

/**
 * Warm theme preset for Black One.
 *
 * A cohesive terracotta-and-amber palette. Light mode uses a soft cream
 * background with warm brown text for readable contrast; dark mode uses a
 * deep warm charcoal with glowing amber accents.
 */
export const warmTheme: ThemePreset = {
  id: "warm",
  label: "Warm",
  description: "Soft terracotta, cream, and amber tones.",
  light: {
    "--background": "30 25% 97%",
    "--foreground": "20 20% 15%",
    "--card": "30 20% 98%",
    "--card-foreground": "20 20% 15%",
    "--popover": "30 25% 98%",
    "--popover-foreground": "20 20% 15%",
    "--primary": "18 70% 43%",
    "--primary-foreground": "30 25% 97%",
    "--secondary": "30 20% 92%",
    "--secondary-foreground": "20 18% 18%",
    "--muted": "30 15% 92%",
    "--muted-foreground": "20 10% 41.5%",
    "--accent": "28 80% 55%",
    "--accent-foreground": "30 25% 19.5%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "30 15% 85%",
    "--input": "30 15% 86%",
    "--ring": "20 70% 45%",
  },
  dark: {
    "--background": "20 15% 8%",
    "--foreground": "30 20% 96%",
    "--card": "20 14% 10%",
    "--card-foreground": "30 20% 96%",
    "--popover": "20 14% 11%",
    "--popover-foreground": "30 20% 96%",
    "--primary": "28 80% 58%",
    "--primary-foreground": "20 25% 10%",
    "--secondary": "20 10% 16%",
    "--secondary-foreground": "30 20% 96%",
    "--muted": "20 10% 15%",
    "--muted-foreground": "25 10% 60%",
    "--accent": "28 75% 50%",
    "--accent-foreground": "30 20% 16.5%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "20 10% 22%",
    "--input": "20 10% 23%",
    "--ring": "28 70% 55%",
  },
};
