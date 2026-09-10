import type { SupportedLocale, TranslationSchema } from '../types/i18n';
import { en } from './en';
import { id } from './id';
import { es } from './es';
import { ja } from './ja';
import { de } from './de';

export const dictionaries: Record<SupportedLocale, TranslationSchema> = {
  en,
  id,
  es,
  ja,
  de,
};

export { en, id, es, ja, de };
