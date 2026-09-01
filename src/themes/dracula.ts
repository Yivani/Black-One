import type { ThemePreset } from "@/lib/themes";

/**
 * Dracula theme preset for Black One.
 *
 * A classic dark-room palette: deep purple-blue background, vivid lavender
 * primary, and hot-pink accents. The light mode keeps the same playful
 * purple identity on a clean white canvas.
 */
export const draculaTheme: ThemePreset = {
  id: "dracula",
  label: "Dracula",
  description: "Deep purples, lavender, and pink highlights.",
  light: {
    "--background": "230 25% 97%",
    "--foreground": "231 25% 18%",
    "--card": "230 25% 99%",
    "--card-foreground": "231 25% 18%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "231 25% 18%",
    "--primary": "265 89% 78%",
    "--primary-foreground": "231 15% 12%",
    "--secondary": "230 20% 92%",
    "--secondary-foreground": "231 25% 18%",
    "--muted": "230 18% 94%",
    "--muted-foreground": "231 15% 40%",
    "--accent": "326 100% 74%",
    "--accent-foreground": "231 15% 12%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "230 20% 87%",
    "--input": "230 20% 86%",
    "--ring": "265 89% 70%",
  },
  dark: {
    "--background": "231 15% 12%",
    "--foreground": "60 30% 96%",
    "--card": "231 15% 14%",
    "--card-foreground": "60 30% 96%",
    "--popover": "231 15% 13%",
    "--popover-foreground": "60 30% 96%",
    "--primary": "265 89% 78%",
    "--primary-foreground": "231 15% 12%",
    "--secondary": "232 14% 20%",
    "--secondary-foreground": "60 30% 96%",
    "--muted": "232 12% 18%",
    "--muted-foreground": "231 10% 62%",
    "--accent": "326 100% 74%",
    "--accent-foreground": "231 15% 12%",
    "--destructive": "0 72% 52.5%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "232 14% 25%",
    "--input": "232 14% 23%",
    "--ring": "265 89% 78%",
  },
};
