import type { Dictionary, LanguageId } from "@/lib/i18n";
import { en } from "./en";
import { de } from "./de";
import { es } from "./es";

export type { TranslationKey } from "./en";

/** Every shipped dictionary, keyed by language. English is the fallback. */
export const DICTIONARIES: Record<LanguageId, Dictionary> = { en, de, es };

export { en, de, es };
