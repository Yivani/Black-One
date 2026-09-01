/**
 * Translation core.
 *
 * Import-free on purpose: every rule that decides *which* language wins and
 * *what* a key renders to is a pure function, so the behaviour is unit-tested
 * without a DOM, a store, or a React tree. The dictionaries themselves live in
 * `src/locales/`, and English is the source of truth — a key missing from a
 * translation falls back to English rather than showing a raw key to the user.
 */

/** Languages the app actually ships translations for. */
export const LANGUAGE_IDS = ["en", "de", "es"] as const;
export type LanguageId = (typeof LANGUAGE_IDS)[number];

/** What the user picks. "system" follows the OS/browser preference. */
export type LanguagePreference = LanguageId | "system";

export interface LanguageOption {
  id: LanguageId;
  /** Name in English, for reference in mixed contexts. */
  label: string;
  /** Name as speakers of that language write it. */
  nativeLabel: string;
  /**
   * Two-letter badge shown in pickers. Deliberately not a flag emoji: Windows
   * ships no glyph for regional-indicator pairs, so a flag renders as two
   * letter boxes that read as a broken font rather than a design choice.
   */
  code: string;
  /** BCP-47 tag used for date, time, and number formatting. */
  locale: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { id: "en", label: "English", nativeLabel: "English", code: "EN", locale: "en-US" },
  { id: "de", label: "German", nativeLabel: "Deutsch", code: "DE", locale: "de-DE" },
  { id: "es", label: "Spanish", nativeLabel: "Español", code: "ES", locale: "es-ES" },
];

export const DEFAULT_LANGUAGE: LanguageId = "en";

export type Dictionary = Readonly<Record<string, string>>;

function isLanguageId(value: string): value is LanguageId {
  return (LANGUAGE_IDS as readonly string[]).includes(value);
}

/**
 * Maps any BCP-47 tag onto a language we ship.
 *
 * Regional tags ("de-AT", "es-419") resolve to their base language, so a user
 * in Austria gets German rather than silently falling back to English.
 */
export function resolveLanguage(tag: string | null | undefined): LanguageId | null {
  if (!tag) return null;
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  if (isLanguageId(normalized)) return normalized;
  const base = normalized.split(/[-_]/)[0];
  return isLanguageId(base) ? base : null;
}

/** First shipped language among the browser/OS preferences, else English. */
export function detectLanguage(
  preferred: readonly string[] | undefined,
): LanguageId {
  for (const tag of preferred ?? []) {
    const resolved = resolveLanguage(tag);
    if (resolved) return resolved;
  }
  return DEFAULT_LANGUAGE;
}

/** Turns the stored preference into the language actually rendered. */
export function activeLanguage(
  preference: LanguagePreference | undefined,
  systemPreferred: readonly string[] | undefined,
): LanguageId {
  if (preference && preference !== "system" && isLanguageId(preference)) {
    return preference;
  }
  return detectLanguage(systemPreferred);
}

export function localeTag(language: LanguageId): string {
  return LANGUAGES.find((entry) => entry.id === language)?.locale ?? "en-US";
}

/**
 * Substitutes `{name}` placeholders.
 *
 * An unknown placeholder is left verbatim: a translator who typos `{cout}` gets
 * a visibly wrong string to fix, not a silent empty gap in the sentence.
 */
export function formatMessage(
  template: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Looks a key up in the active dictionary, falling back to English and then to
 * the key itself. The key is only ever shown when English is missing it too,
 * which means a genuine bug rather than an untranslated string.
 */
export function translate(
  key: string,
  dictionary: Dictionary,
  fallback: Dictionary,
  params?: Readonly<Record<string, string | number>>,
): string {
  const template = dictionary[key] ?? fallback[key] ?? key;
  return formatMessage(template, params);
}

/**
 * Keys present in the reference dictionary but absent from a translation.
 * Used by the coverage test so a new English string cannot ship without at
 * least being noticed in German and Spanish.
 */
export function missingKeys(reference: Dictionary, translation: Dictionary): string[] {
  return Object.keys(reference).filter((key) => translation[key] === undefined);
}

/** Keys a translation defines that no longer exist in English. */
export function staleKeys(reference: Dictionary, translation: Dictionary): string[] {
  return Object.keys(translation).filter((key) => reference[key] === undefined);
}

/** Placeholders used by a template, so translations can be checked against it. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}
