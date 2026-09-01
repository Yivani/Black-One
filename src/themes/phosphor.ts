import type { ThemePreset } from "@/lib/themes";

/**
 * Phosphor theme preset for Black One.
 *
 * A green CRT: dark mode is the real thing, near-black glass with phosphor
 * green burning on it. Light mode is the printout — deep press green on pale
 * paper — so the theme survives being used in daylight.
 */
export const phosphorTheme: ThemePreset = {
  id: "phosphor",
  label: "Phosphor",
  description: "Green CRT glow on near-black glass.",
  light: {
    "--background": "120 12% 96%",
    "--foreground": "140 30% 10%",
    "--card": "120 10% 99%",
    "--card-foreground": "140 30% 10%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "140 30% 10%",
    "--primary": "140 70% 26%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "120 12% 91%",
    "--secondary-foreground": "140 30% 14%",
    "--muted": "120 10% 92%",
    "--muted-foreground": "135 12% 36%",
    "--accent": "150 60% 28%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 70% 42%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "120 10% 84%",
    "--input": "120 10% 84%",
    "--ring": "140 70% 26%",
  },
  dark: {
    "--background": "140 20% 4%",
    "--foreground": "130 60% 82%",
    "--card": "140 18% 6%",
    "--card-foreground": "130 60% 82%",
    "--popover": "140 18% 7%",
    "--popover-foreground": "130 60% 82%",
    "--primary": "135 85% 60%",
    "--primary-foreground": "140 30% 5%",
    "--secondary": "140 15% 13%",
    "--secondary-foreground": "130 60% 82%",
    "--muted": "140 15% 11%",
    "--muted-foreground": "130 25% 62%",
    "--accent": "100 70% 55%",
    "--accent-foreground": "140 30% 5%",
    "--destructive": "0 70% 50%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "140 15% 17%",
    "--input": "140 15% 19%",
    "--ring": "135 85% 60%",
  },
};
