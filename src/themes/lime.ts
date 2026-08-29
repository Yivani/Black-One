import { ThemePreset } from "@/lib/themes";

/**
 * Lime theme preset for Black One.
 *
 * Uses #C3FB3A as the electric-lime accent and #1D1C1C as the dark surface
 * color. Text always flips between that near-black and a soft off-white so
 * selected lime elements stay readable.
 */
export const limeTheme: ThemePreset = {
  id: "lime",
  label: "Lime",
  description: "Near-black surfaces with electric lime highlights.",
  light: {
    "--background": "75 20% 97%",
    "--foreground": "0 2% 11%",
    "--card": "75 16% 99%",
    "--card-foreground": "0 2% 11%",
    "--popover": "75 18% 100%",
    "--popover-foreground": "0 2% 11%",
    "--primary": "78 95% 60%",
    "--primary-foreground": "0 2% 11%",
    "--secondary": "75 14% 93%",
    "--secondary-foreground": "0 2% 15%",
    "--muted": "75 12% 94%",
    "--muted-foreground": "0 2% 40%",
    "--accent": "78 95% 60%",
    "--accent-foreground": "0 2% 11%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "75 12% 88%",
    "--input": "75 12% 90%",
    "--ring": "78 95% 60%",
  },
  dark: {
    "--background": "0 2% 11%",
    "--foreground": "0 0% 95%",
    "--card": "0 2% 13%",
    "--card-foreground": "0 0% 95%",
    "--popover": "0 2% 14%",
    "--popover-foreground": "0 0% 95%",
    "--primary": "78 95% 60%",
    "--primary-foreground": "0 2% 11%",
    "--secondary": "0 2% 18%",
    "--secondary-foreground": "0 0% 95%",
    "--muted": "0 2% 16%",
    "--muted-foreground": "0 0% 60%",
    "--accent": "78 95% 60%",
    "--accent-foreground": "0 2% 11%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "0 2% 20%",
    "--input": "0 2% 22%",
    "--ring": "78 95% 60%",
  },
};
