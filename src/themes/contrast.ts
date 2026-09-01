import type { ThemePreset } from "@/lib/themes";

/**
 * Contrast theme preset for Black One.
 *
 * Legibility first: pure black and white surfaces, text far past the 4.5:1 the
 * other themes are held to, and borders strong enough to see rather than
 * merely infer. For low vision, bright rooms, and bad projectors.
 */
export const contrastTheme: ThemePreset = {
  id: "contrast",
  label: "Contrast",
  description: "Maximum legibility: pure black, white, and hard borders.",
  light: {
    "--background": "0 0% 100%",
    "--foreground": "0 0% 0%",
    "--card": "0 0% 100%",
    "--card-foreground": "0 0% 0%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "0 0% 0%",
    "--primary": "0 0% 0%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "0 0% 92%",
    "--secondary-foreground": "0 0% 0%",
    "--muted": "0 0% 92%",
    "--muted-foreground": "0 0% 25%",
    "--accent": "0 0% 88%",
    "--accent-foreground": "0 0% 0%",
    "--destructive": "0 100% 32%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "0 0% 55%",
    "--input": "0 0% 45%",
    "--ring": "220 100% 40%",
  },
  dark: {
    "--background": "0 0% 0%",
    "--foreground": "0 0% 100%",
    "--card": "0 0% 4%",
    "--card-foreground": "0 0% 100%",
    "--popover": "0 0% 5%",
    "--popover-foreground": "0 0% 100%",
    "--primary": "0 0% 100%",
    "--primary-foreground": "0 0% 0%",
    "--secondary": "0 0% 16%",
    "--secondary-foreground": "0 0% 100%",
    "--muted": "0 0% 14%",
    "--muted-foreground": "0 0% 78%",
    "--accent": "0 0% 22%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 90% 60%",
    "--destructive-foreground": "0 0% 0%",
    "--border": "0 0% 60%",
    "--input": "0 0% 65%",
    "--ring": "55 100% 55%",
  },
};
