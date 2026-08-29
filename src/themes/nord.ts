import { ThemePreset } from "@/lib/themes";

/**
 * Nord theme preset for Black One.
 *
 * Inspired by the Nord color palette: cool polar backgrounds, frost blue
 * primary accents, and aurora teal highlights. Easy on the eyes in both
 * light and dark modes.
 */
export const nordTheme: ThemePreset = {
  id: "nord",
  label: "Nord",
  description: "Cool polar blues with frost and aurora accents.",
  light: {
    "--background": "220 16% 96%",
    "--foreground": "220 16% 22%",
    "--card": "220 16% 98%",
    "--card-foreground": "220 16% 22%",
    "--popover": "220 16% 99%",
    "--popover-foreground": "220 16% 22%",
    "--primary": "213 32% 52%",
    "--primary-foreground": "220 16% 96%",
    "--secondary": "220 16% 91%",
    "--secondary-foreground": "220 16% 22%",
    "--muted": "220 14% 92%",
    "--muted-foreground": "220 10% 42%",
    "--accent": "193 43% 67%",
    "--accent-foreground": "220 16% 22%",
    "--destructive": "354 42% 56%",
    "--destructive-foreground": "220 16% 96%",
    "--border": "220 16% 86%",
    "--input": "220 16% 89%",
    "--ring": "213 32% 52%",
  },
  dark: {
    "--background": "222 16% 18%",
    "--foreground": "219 28% 88%",
    "--card": "222 16% 14%",
    "--card-foreground": "219 28% 88%",
    "--popover": "222 16% 13%",
    "--popover-foreground": "219 28% 88%",
    "--primary": "193 43% 67%",
    "--primary-foreground": "222 16% 18%",
    "--secondary": "222 16% 22%",
    "--secondary-foreground": "219 28% 88%",
    "--muted": "222 14% 20%",
    "--muted-foreground": "220 13% 58%",
    "--accent": "179 25% 65%",
    "--accent-foreground": "222 16% 18%",
    "--destructive": "354 42% 56%",
    "--destructive-foreground": "219 28% 88%",
    "--border": "222 16% 26%",
    "--input": "222 16% 24%",
    "--ring": "193 43% 67%",
  },
};
