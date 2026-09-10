import React from 'react';
import { Link } from 'react-router-dom';
import { Ghost, Home } from 'lucide-react';
import { SEO } from '../components/SEO';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
      <SEO
        title="404 - Page Not Found"
        description="The page you are looking for has vanished or does not exist."
        noIndex={true}
      />
      <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 flex items-center justify-center text-slate-400 mb-5 shadow-sm">
        <Ghost className="w-8 h-8 animate-pulse text-emerald-500" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
        404 - Page Not Found
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
        The route you are looking for has vanished, self-destructed, or does not exist.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-all active:-translate-y-[1px]"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Console</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
