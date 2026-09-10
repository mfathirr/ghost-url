import React from 'react';
import { Link } from 'react-router-dom';
import { Ghost, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { SoundToggle } from './SoundToggle';
import { LanguageToggle } from './LanguageToggle';
import { useTranslation } from '../hooks/useTranslation';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-[#090d12]/85 border-b border-slate-200/80 dark:border-white/5 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" aria-label={t('nav.ariaHome')} className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 dark:bg-black border border-emerald-500/20 dark:border-zinc-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm group-hover:border-emerald-500/40 transition-colors">
            <Ghost className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                Ghost<span className="text-emerald-500">URL</span>
              </span>
              <span className="font-mono text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {t('nav.tagline')}
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
            <span>{t('nav.zeroPersistence')}</span>
          </div>
          <LanguageToggle />
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
