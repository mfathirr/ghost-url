import React, { useState, useRef, useEffect } from 'react';
import { Languages, Check } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import type { SupportedLocale } from '../types/i18n';

export const LanguageToggle: React.FC = () => {
  const { locale, setLocale, locales, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard events (Escape to close)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: SupportedLocale) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('nav.ariaLanguage')}
        title={t('nav.ariaLanguage')}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border transition-all shadow-sm backdrop-blur ${
          isOpen
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/30'
            : 'border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-500/40 dark:hover:border-emerald-500/40'
        }`}
      >
        <Languages className="w-4 h-4" aria-hidden="true" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider">{locale}</span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t('nav.ariaLanguage')}
          className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#0d131a]/95 backdrop-blur-md shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 mb-1 border-b border-slate-100 dark:border-zinc-800/80">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-semibold">
              {t('nav.selectLanguage')}
            </span>
          </div>
          {locales.map((meta) => {
            const isSelected = meta.code === locale;
            return (
              <button
                key={meta.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(meta.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    {meta.code.toUpperCase()}
                  </span>
                  <span className="truncate">{meta.nativeName}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
