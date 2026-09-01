import type { ThemePreset } from "@/lib/themes";

/**
 * Slate theme preset for Black One.
 *
 * The quiet one: a cool steel grey that stays out of the way for a long
 * working day. Saturation is kept low everywhere on purpose — the only colour
 * in the interface should be the code.
 */
export const slateTheme: ThemePreset = {
  id: "slate",
  label: "Slate",
  description: "Cool steel greys that stay out of the way.",
  light: {
    "--background": "215 20% 97%",
    "--foreground": "215 30% 14%",
    "--card": "215 18% 99%",
    "--card-foreground": "215 30% 14%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "215 30% 14%",
    "--primary": "215 40% 35%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "215 18% 91%",
    "--secondary-foreground": "215 30% 18%",
    "--muted": "215 16% 92%",
    "--muted-foreground": "215 14% 38%",
    "--accent": "200 30% 88%",
    "--accent-foreground": "215 30% 18%",
    "--destructive": "0 65% 45%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "215 15% 84%",
    "--input": "215 15% 84%",
    "--ring": "215 40% 35%",
  },
  dark: {
    "--background": "215 22% 9%",
    "--foreground": "210 20% 95%",
    "--card": "215 20% 12%",
    "--card-foreground": "210 20% 95%",
    "--popover": "215 20% 13%",
    "--popover-foreground": "210 20% 95%",
    "--primary": "210 45% 70%",
    "--primary-foreground": "215 30% 10%",
    "--secondary": "215 16% 19%",
    "--secondary-foreground": "210 20% 95%",
    "--muted": "215 16% 17%",
    "--muted-foreground": "213 15% 68%",
    "--accent": "200 25% 25%",
    "--accent-foreground": "210 20% 95%",
    "--destructive": "0 65% 48%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "215 14% 23%",
    "--input": "215 14% 25%",
    "--ring": "210 45% 70%",
  },
};
