import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  auditPalette,
  contrastRatio,
  describeViolation,
  parseHsl,
  ratio,
  readableForeground,
  relativeLuminance,
  hslToRgb,
  TEXT_CONTRAST_MIN,
} from "./contrast.ts";
import { ACCENT_COLORS } from "./constants.ts";
import { THEME_PRESETS } from "./themes.ts";

/**
 * Readability of every theme, in both modes.
 *
 * A preset only overrides part of the palette; the rest comes from
 * `src/index.css`. So the css file is parsed and merged here rather than
 * assumed — this checks the colours that actually render, not a copy of them
 * that can drift.
 */

const CSS = readFileSync(new URL("../index.css", import.meta.url), "utf8");

/** Pulls the HSL custom properties out of one CSS rule. */
function readBlock(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} not found in index.css`);
  const body = CSS.slice(start, CSS.indexOf("}", start));
  const palette: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(
    /(--[a-z-]+):\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)\s*;/g,
  )) {
    palette[name] = value;
  }
  return palette;
}

const BASE = { light: readBlock(":root"), dark: readBlock(".dark") };

const MODES = ["light", "dark"] as const;

function resolve(preset: (typeof THEME_PRESETS)[number], mode: (typeof MODES)[number]) {
  return { ...BASE[mode], ...preset[mode] };
}

// ================================================================ the maths

test("contrast matches the values WCAG defines", () => {
  assert.equal(ratio("0 0% 0%", "0 0% 100%"), 21);
  assert.equal(ratio("0 0% 100%", "0 0% 100%"), 1);
  // #767676 on white is the grey WCAG examples use for the 4.5:1 boundary.
  assert.equal(ratio("0 0% 46.3%", "0 0% 100%"), 4.54);
});

test("hue is converted correctly across the colour wheel", () => {
  const cases: Array<[string, [number, number, number]]> = [
    ["0 100% 50%", [255, 0, 0]],
    ["120 100% 50%", [0, 255, 0]],
    ["240 100% 50%", [0, 0, 255]],
    ["60 100% 50%", [255, 255, 0]],
    ["300 100% 50%", [255, 0, 255]],
    ["0 0% 50%", [127.5, 127.5, 127.5]],
  ];
  for (const [channels, [r, g, b]] of cases) {
    const rgb = hslToRgb(channels);
    assert.ok(rgb, channels);
    assert.deepEqual(
      [rgb.r, rgb.g, rgb.b].map((value) => Math.round(value)),
      [r, g, b].map(Math.round),
      channels,
    );
  }
});

test("an unparseable colour fails rather than passing quietly", () => {
  assert.equal(parseHsl("not a colour"), null);
  assert.equal(parseHsl("#ffffff"), null);
  assert.equal(hslToRgb("210 45%"), null);
  assert.equal(contrastRatio("nonsense", "0 0% 100%"), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
});

// ============================================================== the themes

for (const preset of THEME_PRESETS) {
  for (const mode of MODES) {
    test(`${preset.label} is readable in ${mode} mode`, () => {
      const violations = auditPalette(resolve(preset, mode));
      assert.deepEqual(
        violations.map(describeViolation),
        [],
        `${preset.label} (${mode})`,
      );
    });
  }
}

test("every preset defines a complete palette", () => {
  // A half-defined preset inherits the rest from the default palette, which is
  // how a theme ends up with, say, an indigo button on a green page.
  const required = Object.keys(BASE.light).filter((name) => name !== "--radius");
  for (const preset of THEME_PRESETS) {
    if (preset.id === "default") continue; // Deliberately the css file itself.
    for (const mode of MODES) {
      const missing = required.filter((name) => !(name in preset[mode]));
      assert.deepEqual(missing, [], `${preset.label} (${mode}) is missing`);
    }
  }
});

test("light and dark are actually different modes", () => {
  for (const preset of THEME_PRESETS) {
    const light = relativeLuminance(hslToRgb(resolve(preset, "light")["--background"])!);
    const dark = relativeLuminance(hslToRgb(resolve(preset, "dark")["--background"])!);
    assert.ok(
      light > dark,
      `${preset.label}: the light background is not lighter than the dark one`,
    );
  }
});

test("no two presets share an id", () => {
  const ids = THEME_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every preset is introduced to the user", () => {
  for (const preset of THEME_PRESETS) {
    if (preset.id === "default") continue;
    assert.ok(preset.description, `${preset.label} has no description`);
    assert.ok(
      (preset.description ?? "").length < 70,
      `${preset.label}'s description is too long for the card`,
    );
  }
});

// ============================================================= the accents

/**
 * The accent overrides `--primary` in every theme, so the pair a preset was
 * designed around is not the pair that renders. The label colour is derived
 * from the accent for exactly that reason; this is the proof it works for all
 * of them.
 */
test("every accent gets a readable label, in both modes", () => {
  for (const accent of ACCENT_COLORS) {
    for (const mode of MODES) {
      const background = accent[mode];
      const actual = ratio(readableForeground(background), background);
      assert.ok(
        actual >= TEXT_CONTRAST_MIN,
        `${accent.label} (${mode}) reaches only ${actual}:1`,
      );
    }
  }
});

test("a derived label is readable on any colour a user can pick", () => {
  // The custom accent is a free hex value, so the rule has to hold for every
  // colour, not just the presets. Walked coarsely across the whole space.
  let worst = { channels: "", contrast: Infinity };
  for (let h = 0; h < 360; h += 15) {
    for (let s = 0; s <= 100; s += 20) {
      for (let l = 0; l <= 100; l += 5) {
        const channels = `${h} ${s}% ${l}%`;
        const contrast = contrastRatio(readableForeground(channels), channels);
        if (contrast < worst.contrast) worst = { channels, contrast };
      }
    }
  }
  assert.ok(
    worst.contrast >= TEXT_CONTRAST_MIN,
    `${worst.channels} leaves its label at ${Math.round(worst.contrast * 100) / 100}:1`,
  );
});

test("every theme keeps a readable focus ring under every accent", () => {
  // The accent replaces --ring too, so a pale accent on a pale theme can leave
  // focus invisible — the one state a keyboard user cannot do without.
  const failures: string[] = [];
  for (const preset of THEME_PRESETS) {
    for (const mode of MODES) {
      const background = resolve(preset, mode)["--background"];
      for (const accent of ACCENT_COLORS) {
        const actual = ratio(accent[mode], background);
        if (actual < 3) {
          failures.push(`${preset.label}/${mode}/${accent.label}: ${actual}:1`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});
