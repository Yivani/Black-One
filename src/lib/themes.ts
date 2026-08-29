import type { ThemePresetId } from "@/types/settings";
import { amberTheme } from "@/themes/amber";
import { berryTheme } from "@/themes/berry";
import { coffeeTheme } from "@/themes/coffee";
import { draculaTheme } from "@/themes/dracula";
import { forestTheme } from "@/themes/forest";
import { limeTheme } from "@/themes/lime";
import { mintTheme } from "@/themes/mint";
import { nordTheme } from "@/themes/nord";
import { oceanTheme } from "@/themes/ocean";
import { sakuraTheme } from "@/themes/sakura";
import { solarizedTheme } from "@/themes/solarized";
import { sunsetTheme } from "@/themes/sunset";
import { warmTheme } from "@/themes/warm";

/**
 * Full-app theme preset definitions.
 *
 * Each preset provides HSL channel strings that override the CSS variables in
 * `src/index.css` for both light and dark modes. Values are strings like
 * "210 50% 96%".
 */
export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description?: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Default Black One palette. These match the variables in `src/index.css` so
 * applying this preset is a no-op override.
 */
export const defaultTheme: ThemePreset = {
  id: "default",
  label: "Default",
  light: {
    "--background": "0 0% 100%",
    "--foreground": "240 10% 3.9%",
    "--card": "0 0% 100%",
    "--card-foreground": "240 10% 3.9%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "240 10% 3.9%",
    "--secondary": "240 4.8% 95.9%",
    "--secondary-foreground": "240 5.9% 10%",
    "--muted": "240 4.8% 95.9%",
    "--muted-foreground": "240 3.8% 46.1%",
    "--accent": "240 4.8% 95.9%",
    "--accent-foreground": "240 5.9% 10%",
    "--destructive": "0 84.2% 60.2%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "240 5.9% 90%",
    "--input": "240 5.9% 90%",
    "--ring": "240 5.9% 10%",
  },
  dark: {
    "--background": "240 7% 6%",
    "--foreground": "0 0% 98%",
    "--card": "240 6% 8.5%",
    "--card-foreground": "0 0% 98%",
    "--popover": "240 6% 9%",
    "--popover-foreground": "0 0% 98%",
    "--secondary": "240 4% 14%",
    "--secondary-foreground": "0 0% 98%",
    "--muted": "240 4% 13%",
    "--muted-foreground": "240 5% 66%",
    "--accent": "240 4% 15%",
    "--accent-foreground": "0 0% 98%",
    "--destructive": "0 68% 46%",
    "--destructive-foreground": "0 0% 98%",
    "--border": "240 4% 20%",
    "--input": "240 4% 21%",
    "--ring": "240 4.9% 83.9%",
  },
};

export const THEME_PRESETS: ThemePreset[] = [
  defaultTheme,
  oceanTheme,
  warmTheme,
  forestTheme,
  berryTheme,
  sunsetTheme,
  coffeeTheme,
  mintTheme,
  limeTheme,
  nordTheme,
  draculaTheme,
  solarizedTheme,
  sakuraTheme,
  amberTheme,
];
