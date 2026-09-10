import React from 'react';
import { Link } from 'react-router-dom';
import { Ghost, Home } from 'lucide-react';
import { SEO } from '../components/SEO';
import { useTranslation } from '../hooks/useTranslation';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
      <SEO
        title={t('notFound.title')}
        description={t('notFound.subtitle')}
        noIndex={true}
      />
      <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 flex items-center justify-center text-slate-400 mb-5 shadow-sm">
        <Ghost className="w-8 h-8 animate-pulse text-emerald-500" />
      </div>
      <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-3">
        {t('notFound.badge')}
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
        {t('notFound.title')}
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
        {t('notFound.subtitle')}
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-all active:-translate-y-[1px]"
        >
          <Home className="w-3.5 h-3.5" />
          <span>{t('notFound.homeBtn')}</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
