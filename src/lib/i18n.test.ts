import assert from "node:assert/strict";
import test from "node:test";
import {
  activeLanguage,
  detectLanguage,
  formatMessage,
  localeTag,
  missingKeys,
  placeholders,
  resolveLanguage,
  staleKeys,
  translate,
  LANGUAGES,
  LANGUAGE_IDS,
} from "./i18n.ts";

// ------------------------------------------------------------ tag resolution

test("resolves the languages we ship", () => {
  assert.equal(resolveLanguage("en"), "en");
  assert.equal(resolveLanguage("de"), "de");
  assert.equal(resolveLanguage("es"), "es");
});

test("a regional tag resolves to its base language", () => {
  assert.equal(resolveLanguage("de-AT"), "de", "Austrian German is still German");
  assert.equal(resolveLanguage("de_CH"), "de", "underscore form too");
  assert.equal(resolveLanguage("es-419"), "es", "Latin American Spanish");
  assert.equal(resolveLanguage("EN-GB"), "en", "case is irrelevant");
});

test("an unshipped language resolves to nothing rather than guessing", () => {
  assert.equal(resolveLanguage("fr"), null);
  assert.equal(resolveLanguage("zh-Hans"), null);
  assert.equal(resolveLanguage(""), null);
  assert.equal(resolveLanguage("   "), null);
  assert.equal(resolveLanguage(undefined), null);
  assert.equal(resolveLanguage(null), null);
});

// -------------------------------------------------------------- detection

test("picks the first shipped language from the system preferences", () => {
  assert.equal(detectLanguage(["fr-FR", "de-DE", "en-US"]), "de");
  assert.equal(detectLanguage(["es"]), "es");
});

test("falls back to English when nothing matches", () => {
  assert.equal(detectLanguage(["fr", "ja"]), "en");
  assert.equal(detectLanguage([]), "en");
  assert.equal(detectLanguage(undefined), "en");
});

test("an explicit choice beats the system preference", () => {
  assert.equal(activeLanguage("de", ["es-ES"]), "de");
  assert.equal(activeLanguage("system", ["es-ES"]), "es");
  assert.equal(activeLanguage(undefined, ["de-DE"]), "de");
});

test("a stored language we no longer ship falls back to the system", () => {
  assert.equal(
    activeLanguage("fr" as never, ["es-ES"]),
    "es",
    "a removed locale must not strand the UI on a missing dictionary",
  );
});

// ---------------------------------------------------------- interpolation

test("substitutes named placeholders", () => {
  assert.equal(formatMessage("{count} shells", { count: 3 }), "3 shells");
  assert.equal(
    formatMessage("{done} of {total} done", { done: 2, total: 5 }),
    "2 of 5 done",
  );
});

test("leaves an unknown placeholder visible instead of blanking it", () => {
  assert.equal(
    formatMessage("{count} of {totl}", { count: 1 }),
    "1 of {totl}",
    "a typo must be obvious to whoever wrote it",
  );
});

test("a template without params is returned untouched", () => {
  assert.equal(formatMessage("Settings"), "Settings");
  assert.equal(formatMessage("100% {done}"), "100% {done}");
});

// ------------------------------------------------------------- translation

const base = { greeting: "Hello", count: "{n} items", only: "English only" };
const other = { greeting: "Hallo", count: "{n} Einträge" };

test("uses the active dictionary", () => {
  assert.equal(translate("greeting", other, base), "Hallo");
  assert.equal(translate("count", other, base, { n: 4 }), "4 Einträge");
});

test("falls back to English for an untranslated key", () => {
  assert.equal(translate("only", other, base), "English only");
});

test("shows the key only when English is missing it too", () => {
  assert.equal(translate("nope", other, base), "nope");
});

// -------------------------------------------------------- dictionary tools

test("missingKeys reports what a translation has not covered", () => {
  assert.deepEqual(missingKeys(base, other), ["only"]);
  assert.deepEqual(missingKeys(base, base), []);
});

test("staleKeys reports translations for keys English dropped", () => {
  assert.deepEqual(staleKeys(base, { ...other, gone: "weg" }), ["gone"]);
  assert.deepEqual(staleKeys(base, other), []);
});

test("placeholders lists what a template expects", () => {
  assert.deepEqual(placeholders("{done} of {total}"), ["done", "total"]);
  assert.deepEqual(placeholders("no params"), []);
});

// -------------------------------------------------------------- metadata

test("every shipped id has display metadata and a locale tag", () => {
  for (const id of LANGUAGE_IDS) {
    const entry = LANGUAGES.find((language) => language.id === id);
    assert.ok(entry, `${id} is missing from LANGUAGES`);
    assert.ok(entry.nativeLabel.length > 0, `${id} has no native label`);
    assert.match(entry.code, /^[A-Z]{2}$/, `${id} has no two-letter badge`);
    assert.match(localeTag(id), /^[a-z]{2}-[A-Z]{2}$/, `${id} has no BCP-47 tag`);
  }
});

test("an unknown language still yields a usable locale tag", () => {
  assert.equal(localeTag("fr" as never), "en-US");
});
