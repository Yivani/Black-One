/**
 * Contrast math for the theme presets.
 *
 * A palette that looks pretty in a swatch grid can still be unreadable in the
 * app — muted grey on a muted panel is the usual way it happens. These are the
 * WCAG 2.1 formulas, applied to the HSL channel strings the presets store, so
 * "is this theme readable?" is a number rather than an opinion.
 *
 * Import-free: every theme is checked in a unit test without a browser.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses the `"210 45% 12%"` form CSS custom properties are stored in. */
export function parseHsl(channels: string): { h: number; s: number; l: number } | null {
  const match = /^\s*(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%\s*$/.exec(channels);
  if (!match) return null;
  const [h, s, l] = match.slice(1).map(Number);
  if ([h, s, l].some((value) => !Number.isFinite(value))) return null;
  return { h, s: s / 100, l: l / 100 };
}

export function hslToRgb(channels: string): Rgb | null {
  const hsl = parseHsl(channels);
  if (!hsl) return null;
  const { h, s, l } = hsl;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast ratio between two HSL channel strings, from 1 (identical) to 21
 * (black on white). Returns 0 when either colour cannot be parsed, which fails
 * a threshold rather than silently passing it.
 */
export function contrastRatio(a: string, b: string): number {
  const first = hslToRgb(a);
  const second = hslToRgb(b);
  if (!first || !second) return 0;
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

/** Rounded to two places, which is how contrast is conventionally quoted. */
export function ratio(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

const BLACK = "0 0% 0%";
const WHITE = "0 0% 100%";

/**
 * The readable text colour for a background — near-black or near-white,
 * whichever wins.
 *
 * This is what makes the accent colour safe. A preset ships its own
 * `--primary-foreground`, but the accent the user picks replaces `--primary`
 * underneath it, so the pair the preset was designed around no longer exists.
 * Deriving the label colour from the button colour keeps them matched whatever
 * the user chooses, custom hex included.
 */
export function readableForeground(background: string): string {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE)
    ? BLACK
    : WHITE;
}

// --------------------------------------------------------------- auditing

/** WCAG AA for body text. */
export const TEXT_CONTRAST_MIN = 4.5;
/** WCAG AA for large text and for the boundary of an interactive control. */
export const UI_CONTRAST_MIN = 3;
/** A separator has to be visible without drawing the eye. */
export const SEPARATOR_CONTRAST_MIN = 1.25;

export interface ContrastRule {
  /** What the pair is, in the words someone reading a failure needs. */
  label: string;
  foreground: string;
  background: string;
  min: number;
}

/**
 * Every pair a palette has to get right.
 *
 * `--input` and `--border` are the outlines of controls rather than text, so
 * they are held to the lower bars: an invisible field border is a real defect,
 * a low-contrast one is a choice.
 */
export const CONTRAST_RULES: ContrastRule[] = [
  { label: "body text", foreground: "--foreground", background: "--background", min: TEXT_CONTRAST_MIN },
  { label: "text on a card", foreground: "--card-foreground", background: "--card", min: TEXT_CONTRAST_MIN },
  { label: "text in a popover", foreground: "--popover-foreground", background: "--popover", min: TEXT_CONTRAST_MIN },
  { label: "text on a secondary surface", foreground: "--secondary-foreground", background: "--secondary", min: TEXT_CONTRAST_MIN },
  { label: "muted text on its own surface", foreground: "--muted-foreground", background: "--muted", min: TEXT_CONTRAST_MIN },
  { label: "muted text on the page", foreground: "--muted-foreground", background: "--background", min: TEXT_CONTRAST_MIN },
  { label: "muted text on a card", foreground: "--muted-foreground", background: "--card", min: TEXT_CONTRAST_MIN },
  { label: "text on an accent surface", foreground: "--accent-foreground", background: "--accent", min: TEXT_CONTRAST_MIN },
  { label: "text on a primary button", foreground: "--primary-foreground", background: "--primary", min: TEXT_CONTRAST_MIN },
  { label: "text on a destructive button", foreground: "--destructive-foreground", background: "--destructive", min: TEXT_CONTRAST_MIN },
  { label: "a field outline", foreground: "--input", background: "--background", min: SEPARATOR_CONTRAST_MIN },
  { label: "a border on the page", foreground: "--border", background: "--background", min: SEPARATOR_CONTRAST_MIN },
  { label: "a border on a card", foreground: "--border", background: "--card", min: SEPARATOR_CONTRAST_MIN },
  { label: "the focus ring", foreground: "--ring", background: "--background", min: UI_CONTRAST_MIN },
];

export interface ContrastViolation extends ContrastRule {
  actual: number;
}

/**
 * Checks one resolved palette. Variables the palette does not define are
 * skipped — a preset inherits those from `src/index.css`, and the caller is
 * expected to merge before auditing.
 */
export function auditPalette(
  palette: Readonly<Record<string, string>>,
): ContrastViolation[] {
  const violations: ContrastViolation[] = [];
  for (const rule of CONTRAST_RULES) {
    const foreground = palette[rule.foreground];
    const background = palette[rule.background];
    if (!foreground || !background) continue;
    const actual = ratio(foreground, background);
    if (actual < rule.min) violations.push({ ...rule, actual });
  }
  return violations;
}

/** A one-line description of a failure, for a test report. */
export function describeViolation(violation: ContrastViolation): string {
  return `${violation.label} (${violation.foreground} on ${violation.background}) is ${violation.actual}:1, needs ${violation.min}:1`;
}
