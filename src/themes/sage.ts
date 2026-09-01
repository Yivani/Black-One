import type { ThemePreset } from "@/lib/themes";

/**
 * Sage theme preset for Black One.
 *
 * A dusty grey-green with the saturation taken out — the calm end of the green
 * family, where Forest is deep evergreen and Lime is electric.
 */
export const sageTheme: ThemePreset = {
  id: "sage",
  label: "Sage",
  description: "Dusty grey-green, calm and low in saturation.",
  light: {
    "--background": "100 15% 96%",
    "--foreground": "120 20% 15%",
    "--card": "100 12% 99%",
    "--card-foreground": "120 20% 15%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "120 20% 15%",
    "--primary": "130 30% 34%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "100 14% 91%",
    "--secondary-foreground": "120 20% 18%",
    "--muted": "100 12% 92%",
    "--muted-foreground": "115 10% 37%",
    "--accent": "85 25% 86%",
    "--accent-foreground": "120 20% 18%",
    "--destructive": "5 60% 42%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "100 12% 84%",
    "--input": "100 12% 84%",
    "--ring": "130 30% 34%",
  },
  dark: {
    "--background": "130 12% 8%",
    "--foreground": "100 15% 92%",
    "--card": "130 11% 11%",
    "--card-foreground": "100 15% 92%",
    "--popover": "130 11% 12%",
    "--popover-foreground": "100 15% 92%",
    "--primary": "120 30% 62%",
    "--primary-foreground": "130 20% 9%",
    "--secondary": "130 10% 18%",
    "--secondary-foreground": "100 15% 92%",
    "--muted": "130 10% 16%",
    "--muted-foreground": "110 12% 66%",
    "--accent": "90 25% 30%",
    "--accent-foreground": "100 15% 92%",
    "--destructive": "5 60% 48%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "130 9% 22%",
    "--input": "130 9% 24%",
    "--ring": "120 30% 62%",
  },
};
