import { describe, it, expect } from 'vitest';
import { en, id, es, ja, de } from '../locales';
import { SUPPORTED_LOCALES, type SupportedLocale, type TranslationSchema } from '../types/i18n';

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys.sort();
}

function getNestedValue(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

describe('i18n Dictionary Parity', () => {
  const canonicalKeys = getAllKeys(en as unknown as Record<string, unknown>);

  it('should have non-empty canonical English keys', () => {
    expect(canonicalKeys.length).toBeGreaterThan(40);
    for (const key of canonicalKeys) {
      const val = getNestedValue(en, key);
      expect(val).toBeDefined();
      expect(val?.trim()).not.toBe('');
    }
  });

  const testLocales: Array<{ code: SupportedLocale; dict: TranslationSchema }> = [
    { code: 'id', dict: id },
    { code: 'es', dict: es },
    { code: 'ja', dict: ja },
    { code: 'de', dict: de },
  ];

  testLocales.forEach(({ code, dict }) => {
    it(`locale '${code}' should contain 100% of canonical keys without missing entries`, () => {
      const localeKeys = getAllKeys(dict as unknown as Record<string, unknown>);
      const missingKeys = canonicalKeys.filter((k) => !localeKeys.includes(k));

      expect(missingKeys).toEqual([]);
      for (const key of canonicalKeys) {
        const val = getNestedValue(dict, key);
        expect(val, `Key '${key}' in locale '${code}' should not be empty`).toBeDefined();
        expect(val?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  it('should define all metadata entries in SUPPORTED_LOCALES', () => {
    const supportedCodes: SupportedLocale[] = ['en', 'id', 'es', 'ja', 'de'];
    for (const code of supportedCodes) {
      expect(SUPPORTED_LOCALES[code]).toBeDefined();
      expect(SUPPORTED_LOCALES[code].code).toBe(code);
      expect(SUPPORTED_LOCALES[code].name).toBeTruthy();
      expect(SUPPORTED_LOCALES[code].nativeName).toBeTruthy();
      expect(SUPPORTED_LOCALES[code].dir).toBe('ltr');
    }
  });
});

describe('i18n Interpolation Logic', () => {
  it('interpolates single parameter tokens properly', () => {
    const template = 'Expires in {time}';
    const result = template.replace(new RegExp('\\{time\\}', 'g'), '24m 10s');
    expect(result).toBe('Expires in 24m 10s');
  });

  it('interpolates count parameter tokens in Indonesian and Japanese', () => {
    const idTemplate = id.created.viewsAllowed;
    const resultId = idTemplate.replace(new RegExp('\\{count\\}', 'g'), '3');
    expect(resultId).toBe('Bisa dibuka 3 kali');

    const jaTemplate = ja.created.viewsAllowed;
    const resultJa = jaTemplate.replace(new RegExp('\\{count\\}', 'g'), '1');
    expect(resultJa).toBe('閲覧可能回数: 1 回');
  });
});
