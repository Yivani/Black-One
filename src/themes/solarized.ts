import { ThemePreset } from "@/lib/themes";

/**
 * Solarized theme preset for Black One.
 *
 * The classic low-contrast palette: warm ivory in light mode, deep cyan-blue
 * in dark mode, with solarized orange and green accents.
 */
export const solarizedTheme: ThemePreset = {
  id: "solarized",
  label: "Solarized",
  description: "Low-contrast ivory and cyan-blue with orange accents.",
  light: {
    "--background": "44 50% 95%",
    "--foreground": "196 13% 22%",
    "--card": "44 40% 97%",
    "--card-foreground": "196 13% 22%",
    "--popover": "44 50% 98%",
    "--popover-foreground": "196 13% 22%",
    "--primary": "18 80% 44%",
    "--primary-foreground": "44 50% 95%",
    "--secondary": "44 40% 90%",
    "--secondary-foreground": "196 13% 22%",
    "--muted": "44 35% 88%",
    "--muted-foreground": "196 10% 40%",
    "--accent": "68 100% 30%",
    "--accent-foreground": "44 50% 95%",
    "--destructive": "1 71% 52%",
    "--destructive-foreground": "44 50% 95%",
    "--border": "44 30% 80%",
    "--input": "44 30% 83%",
    "--ring": "18 80% 44%",
  },
  dark: {
    "--background": "192 81% 14%",
    "--foreground": "44 40% 86%",
    "--card": "192 70% 16%",
    "--card-foreground": "44 40% 86%",
    "--popover": "192 70% 15%",
    "--popover-foreground": "44 40% 86%",
    "--primary": "175 59% 47%",
    "--primary-foreground": "192 81% 14%",
    "--secondary": "192 30% 20%",
    "--secondary-foreground": "44 40% 86%",
    "--muted": "192 25% 18%",
    "--muted-foreground": "44 20% 55%",
    "--accent": "18 80% 50%",
    "--accent-foreground": "44 50% 95%",
    "--destructive": "1 71% 52%",
    "--destructive-foreground": "44 50% 95%",
    "--border": "192 25% 24%",
    "--input": "192 25% 22%",
    "--ring": "175 59% 47%",
  },
};
