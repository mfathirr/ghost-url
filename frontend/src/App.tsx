import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LoadingSpinner } from './components/LoadingSpinner';
import { P2PProvider, useP2PContext } from './context/P2PContext';
import { IncomingModal } from './components/IncomingModal';
import { Analytics } from '@vercel/analytics/react';

const CreatePage = lazy(() => import('./pages/CreatePage'));
const CreatedPage = lazy(() => import('./pages/CreatedPage'));
const RedirectPage = lazy(() => import('./pages/RedirectPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const AppContent: React.FC = () => {
  const {
    incomingTransfer,
    clearIncoming,
    acceptIncomingFile,
    rejectIncomingFile,
    incomingProgress,
  } = useP2PContext();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 dark:bg-[#090d12] text-slate-900 dark:text-slate-100 transition-colors font-sans">
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
      <footer className="border-t border-slate-200/80 dark:border-white/5 py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            GhostURL | Ephemeral Link Sharing &amp; Zero-Storage P2P Beaming •{' '}
            <a
              href="https://github.com/mfathirr/ghost-url"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-500 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors"
            >
              Open Source (MIT)
            </a>
          </div>
          <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500 font-mono text-[11px]">
            <span>Zero Persistent Logs</span>
            <span>•</span>
            <span>Encrypted Direct Transfer</span>
            <span>•</span>
            <span>Passcode Protected</span>
          </div>
        </div>
      </footer>

      {/* Global incoming transfer modal active on baseUrl and all routes */}
      <IncomingModal
        transfer={incomingTransfer}
        onDismiss={clearIncoming}
        onAcceptFile={acceptIncomingFile}
        onRejectFile={rejectIncomingFile}
        incomingProgress={incomingProgress}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <P2PProvider>
      <AppContent />
      <Analytics />
    </P2PProvider>
  );
};

export default App;
