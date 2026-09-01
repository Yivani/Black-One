import type { ThemePreset } from "@/lib/themes";

/**
 * Midnight theme preset for Black One.
 *
 * Deep indigo rather than the cyan of Ocean or the polar blue of Nord: light
 * mode is a cool periwinkle paper, dark mode a near-black navy lit by a single
 * bright indigo.
 */
export const midnightTheme: ThemePreset = {
  id: "midnight",
  label: "Midnight",
  description: "Deep indigo night with a bright periwinkle accent.",
  light: {
    "--background": "230 30% 97%",
    "--foreground": "232 45% 12%",
    "--card": "230 25% 99%",
    "--card-foreground": "232 45% 12%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "232 45% 12%",
    "--primary": "235 60% 45%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "230 25% 92%",
    "--secondary-foreground": "232 40% 18%",
    "--muted": "230 22% 93%",
    "--muted-foreground": "232 18% 38%",
    "--accent": "245 50% 46%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 45%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "230 20% 85%",
    "--input": "230 20% 85%",
    "--ring": "235 60% 45%",
  },
  dark: {
    "--background": "233 40% 7%",
    "--foreground": "225 30% 95%",
    "--card": "233 35% 10%",
    "--card-foreground": "225 30% 95%",
    "--popover": "233 35% 11%",
    "--popover-foreground": "225 30% 95%",
    "--primary": "235 85% 72%",
    "--primary-foreground": "233 45% 10%",
    "--secondary": "233 25% 17%",
    "--secondary-foreground": "225 30% 95%",
    "--muted": "233 25% 15%",
    "--muted-foreground": "228 20% 66%",
    "--accent": "250 80% 72%",
    "--accent-foreground": "233 45% 10%",
    "--destructive": "0 70% 50%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "233 22% 21%",
    "--input": "233 22% 23%",
    "--ring": "235 85% 72%",
  },
};
