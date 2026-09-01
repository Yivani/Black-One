import { useCallback, useEffect, useMemo } from "react";
import {
  DEFAULT_LANGUAGE,
  activeLanguage,
  localeTag,
  translate,
  type LanguageId,
} from "@/lib/i18n";
import { DICTIONARIES, type TranslationKey } from "@/locales";
import { useSettingsStore } from "@/stores/settingsStore";

type Params = Readonly<Record<string, string | number>>;

function systemPreferences(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);
}

/** The language actually being rendered, resolving "system" against the OS. */
export function useLanguage(): LanguageId {
  const preference = useSettingsStore((s) => s.settings.general.language);
  return useMemo(
    () => activeLanguage(preference, systemPreferences()),
    [preference],
  );
}

/**
 * Translation for components.
 *
 * `t` is stable for a given language, so it is safe in dependency arrays.
 * `locale` is the BCP-47 tag to hand to `Intl` for dates and numbers, which
 * otherwise stay in the OS locale while the words around them change.
 */
export function useTranslation() {
  const language = useLanguage();

  const t = useCallback(
    (key: TranslationKey, params?: Params) =>
      translate(key, DICTIONARIES[language], DICTIONARIES[DEFAULT_LANGUAGE], params),
    [language],
  );

  const locale = useMemo(() => localeTag(language), [language]);

  // Screen readers and CSS hyphenation both key off the document language.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  return { t, language, locale };
}

/**
 * Translation outside React — stores, notification builders, tray payloads.
 * Reads the current setting on each call rather than closing over it.
 */
export function translateNow(key: TranslationKey, params?: Params): string {
  const preference = useSettingsStore.getState().settings.general.language;
  const language = activeLanguage(preference, systemPreferences());
  return translate(
    key,
    DICTIONARIES[language],
    DICTIONARIES[DEFAULT_LANGUAGE],
    params,
  );
}

/** Current BCP-47 tag for `Intl` use outside React. */
export function currentLocale(): string {
  const preference = useSettingsStore.getState().settings.general.language;
  return localeTag(activeLanguage(preference, systemPreferences()));
}
