import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { SupportedLocale, LocaleMeta } from '../types/i18n';
import { SUPPORTED_LOCALES } from '../types/i18n';
import { dictionaries } from '../locales';
import { soundFx } from '../utils/soundEngine';

const STORAGE_KEY = 'ghost_locale';

export interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  locales: LocaleMeta[];
  currentLocaleMeta: LocaleMeta;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';

  try {
    // 1. Check local storage
    const stored = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (stored && stored in SUPPORTED_LOCALES) {
      return stored;
    }

    // 2. Check query parameter ?lang=
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang') as SupportedLocale | null;
    if (queryLang && queryLang in SUPPORTED_LOCALES) {
      return queryLang;
    }

    // 3. Check browser language
    const navLangs = navigator.languages || [navigator.language];
    for (const lang of navLangs) {
      const lower = lang.toLowerCase();
      if (lower.startsWith('id')) return 'id';
      if (lower.startsWith('ja')) return 'ja';
      if (lower.startsWith('de')) return 'de';
      if (lower.startsWith('es')) return 'es';
      if (lower.startsWith('en')) return 'en';
    }

    // 4. Check domain identity (.web.id deployment defaults to Indonesian)
    if (window.location.hostname.endsWith('.web.id')) {
      return 'id';
    }
  } catch {
    // ignore
  }

  return 'en';
}

function resolveNestedKey(obj: unknown, path: string): string | undefined {
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

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectInitialLocale);

  // Synchronize document attributes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES.en;
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
  }, [locale]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    if (!(newLocale in SUPPORTED_LOCALES)) return;
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
    // Tactile audio feedback on language switch
    soundFx.playMicroTick();
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const currentDict = dictionaries[locale] || dictionaries.en;
      let raw = resolveNestedKey(currentDict, path);

      // Fallback to English if key is missing in active language
      if (raw === undefined && locale !== 'en') {
        raw = resolveNestedKey(dictionaries.en, path);
      }

      if (raw === undefined) {
        return path;
      }

      if (!params) {
        return raw;
      }

      return Object.entries(params).reduce((acc, [key, val]) => {
        return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
      }, raw);
    },
    [locale]
  );

  const locales = useMemo(() => Object.values(SUPPORTED_LOCALES), []);
  const currentLocaleMeta = useMemo(() => SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES.en, [locale]);

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales,
      currentLocaleMeta,
    }),
    [locale, setLocale, t, locales, currentLocaleMeta]
  );

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
