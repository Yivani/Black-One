import { ThemePreset } from "@/lib/themes";

/**
 * Sakura theme preset for Black One.
 *
 * Soft cherry-blossom pinks over warm white in light mode, with a deep
 * rosewood background in dark mode. Gentle and readable.
 */
export const sakuraTheme: ThemePreset = {
  id: "sakura",
  label: "Sakura",
  description: "Cherry-blossom pinks over warm white or rosewood.",
  light: {
    "--background": "350 40% 97%",
    "--foreground": "340 30% 18%",
    "--card": "350 35% 98%",
    "--card-foreground": "340 30% 18%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "340 30% 18%",
    "--primary": "340 75% 58%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "350 30% 92%",
    "--secondary-foreground": "340 30% 18%",
    "--muted": "350 28% 94%",
    "--muted-foreground": "340 20% 42%",
    "--accent": "340 70% 45%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 51%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "350 25% 87%",
    "--input": "350 25% 90%",
    "--ring": "340 75% 58%",
  },
  dark: {
    "--background": "340 25% 12%",
    "--foreground": "350 30% 94%",
    "--card": "340 22% 14%",
    "--card-foreground": "350 30% 94%",
    "--popover": "340 22% 13%",
    "--popover-foreground": "350 30% 94%",
    "--primary": "340 75% 70%",
    "--primary-foreground": "340 25% 12%",
    "--secondary": "340 18% 18%",
    "--secondary-foreground": "350 30% 94%",
    "--muted": "340 15% 16%",
    "--muted-foreground": "350 18% 62%",
    "--accent": "340 70% 58%",
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 55%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "340 18% 22%",
    "--input": "340 18% 20%",
    "--ring": "340 75% 70%",
  },
};
