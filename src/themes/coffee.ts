import { ThemePreset } from "@/lib/themes";

/**
 * Coffee theme preset for Black One.
 *
 * A cozy espresso-and-caramel palette. Light mode pairs warm cream with
 * roasted-brown text; dark mode brews a near-black cup with golden accents.
 */
export const coffeeTheme: ThemePreset = {
  id: "coffee",
  label: "Coffee",
  description: "Cream, caramel, and espresso tones.",
  light: {
    "--background": "30 25% 96%",
    "--foreground": "25 25% 15%",
    "--card": "30 20% 97%",
    "--card-foreground": "25 25% 15%",
    "--popover": "30 25% 98%",
    "--popover-foreground": "25 25% 15%",
    "--primary": "25 55% 40%",
    "--primary-foreground": "30 25% 97%",
    "--secondary": "30 18% 91%",
    "--secondary-foreground": "25 25% 15%",
    "--muted": "30 15% 92%",
    "--muted-foreground": "25 12% 40%",
    "--accent": "35 75% 50%",
    "--accent-foreground": "25 30% 10%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "30 12% 85%",
    "--input": "30 12% 88%",
    "--ring": "25 55% 40%",
  },
  dark: {
    "--background": "25 15% 8%",
    "--foreground": "30 20% 96%",
    "--card": "25 12% 10%",
    "--card-foreground": "30 20% 96%",
    "--popover": "25 12% 11%",
    "--popover-foreground": "30 20% 96%",
    "--primary": "30 60% 58%",
    "--primary-foreground": "25 30% 10%",
    "--secondary": "25 10% 16%",
    "--secondary-foreground": "30 20% 96%",
    "--muted": "25 10% 15%",
    "--muted-foreground": "30 12% 60%",
    "--accent": "35 70% 52%",
    "--accent-foreground": "25 30% 10%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "25 10% 20%",
    "--input": "25 10% 23%",
    "--ring": "30 60% 58%",
  },
};
