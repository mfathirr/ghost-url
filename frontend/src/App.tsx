import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LoadingSpinner } from './components/LoadingSpinner';

// Route-based code splitting following react-vite-best-practices
const CreatePage = lazy(() => import('./pages/CreatePage'));
const CreatedPage = lazy(() => import('./pages/CreatedPage'));
const RedirectPage = lazy(() => import('./pages/RedirectPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1">
        <Suspense fallback={<LoadingSpinner message="Loading view..." />}>
          <Routes>
            <Route path="/" element={<CreatePage />} />
            <Route path="/created" element={<CreatedPage />} />
            <Route path="/r/:slug" element={<RedirectPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            GhostURL — Ephemeral Link Sharing powered by Go, Gin & Redis TTL
          </div>
          <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
            <span>Zero Persistent Logs</span>
            <span>•</span>
            <span>Automatic Redis Expiry</span>
            <span>•</span>
            <span>Bcrypt Protected</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default App;
