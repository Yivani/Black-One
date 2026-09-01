import type { ThemePresetId } from "@/types/settings";
import { amberTheme } from "../themes/amber.ts";
import { berryTheme } from "../themes/berry.ts";
import { coffeeTheme } from "../themes/coffee.ts";
import { contrastTheme } from "../themes/contrast.ts";
import { crimsonTheme } from "../themes/crimson.ts";
import { draculaTheme } from "../themes/dracula.ts";
import { forestTheme } from "../themes/forest.ts";
import { limeTheme } from "../themes/lime.ts";
import { midnightTheme } from "../themes/midnight.ts";
import { mintTheme } from "../themes/mint.ts";
import { nordTheme } from "../themes/nord.ts";
import { oceanTheme } from "../themes/ocean.ts";
import { phosphorTheme } from "../themes/phosphor.ts";
import { sageTheme } from "../themes/sage.ts";
import { sakuraTheme } from "../themes/sakura.ts";
import { slateTheme } from "../themes/slate.ts";
import { solarizedTheme } from "../themes/solarized.ts";
import { sunsetTheme } from "../themes/sunset.ts";
import { vaporTheme } from "../themes/vapor.ts";
import { warmTheme } from "../themes/warm.ts";

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
    "--muted-foreground": "240 3.8% 44%",
    "--accent": "240 4.8% 95.9%",
    "--accent-foreground": "240 5.9% 10%",
    "--destructive": "0 84.2% 48%",
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
  midnightTheme,
  slateTheme,
  crimsonTheme,
  vaporTheme,
  phosphorTheme,
  sageTheme,
  contrastTheme,
];
