import assert from "node:assert/strict";
import test from "node:test";
import { missingKeys, placeholders, staleKeys } from "./i18n.ts";
import { de } from "../locales/de.ts";
import { en } from "../locales/en.ts";
import { es } from "../locales/es.ts";

/**
 * Coverage guard. `Record<TranslationKey, string>` already makes TypeScript
 * reject an incomplete translation, but these run in plain node and also catch
 * the failure modes types cannot see: a placeholder renamed in one language,
 * or a translation left byte-identical to English by accident.
 */

const TRANSLATIONS = [
  ["German", de],
  ["Spanish", es],
] as const;

for (const [name, dictionary] of TRANSLATIONS) {
  test(`${name} covers every English key`, () => {
    assert.deepEqual(missingKeys(en, dictionary), []);
  });

  test(`${name} has no keys English dropped`, () => {
    assert.deepEqual(staleKeys(en, dictionary), []);
  });

  test(`${name} keeps every placeholder intact`, () => {
    for (const [key, source] of Object.entries(en)) {
      assert.deepEqual(
        placeholders(dictionary[key as keyof typeof en]),
        placeholders(source),
        `${key} changed its placeholders in ${name}`,
      );
    }
  });

  test(`${name} actually translates the copy`, () => {
    // Proper nouns, format strings, and loanwords are legitimately identical.
    const shared = new Set([
      "chat.sendWithEnter",
      "cc.filterCode",
      "cc.filterAgent",
      "cc.tokens",
      "cc.updates",
      "settings.general",
      "settings.chat",
      "models.topP",
      "models.sampling",
      "notifications.testTitle",
      "advanced.headerName",
      "sidebar.terminals",
      "advanced.logLevel",
      "settings.groupSystem",
      "appearance.themeSystem",
      "chat.personalityKawaii",
      "chat.personalityCatgirl",
      "chat.personalityShakespeare",
      "memory.sourceTerminal",
      "memory.sourceChat",
      "memory.sourceManual",
    ]);
    const untranslated = Object.keys(en).filter(
      (key) =>
        !shared.has(key) &&
        dictionary[key as keyof typeof en] === en[key as keyof typeof en],
    );
    assert.deepEqual(
      untranslated,
      [],
      `${name} left these keys in English; translate them or add them to the shared list`,
    );
  });
}

test("English is a non-trivial dictionary", () => {
  assert.ok(
    Object.keys(en).length > 100,
    "the shipped key set should cover the app shell, not a handful of strings",
  );
});
