import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  Ghost,
  Eye,
  EyeOff,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { getLinkMetadata, unlockLink } from '../services/api';
import type { LinkMetadata } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEO } from '../components/SEO';

export const RedirectPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const checkLink = async () => {
      try {
        setLoading(true);
        const meta = await getLinkMetadata(slug);
        setMetadata(meta);

        // If link is not protected by passcode, unlock and redirect immediately
        if (!meta.protected) {
          setRedirecting(true);
          const res = await unlockLink(slug, '');
          window.location.replace(res.url);
          return;
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    checkLink();
  }, [slug]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;

    if (!passcode.trim()) {
      setErrorMessage('Please enter the passcode to unlock this link');
      return;
    }

    try {
      setUnlocking(true);
      setErrorMessage(null);
      const res = await unlockLink(slug, passcode.trim());
      setRedirecting(true);
      window.location.replace(res.url);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to unlock link. Please check your passcode.');
      }
      setUnlocking(false);
    }
  };

  if (loading || redirecting) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <SEO
          title={redirecting ? 'Redirecting...' : 'Verifying Link'}
          description="Verifying ephemeral link destination."
          noIndex={true}
        />
        <LoadingSpinner message={redirecting ? 'Access granted. Redirecting to destination...' : 'Verifying ghost link...'} />
      </div>
    );
  }

  // Expired or Not Found State
  if (notFound || !metadata) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center animate-fade-in">
        <SEO
          title="Link Vanished"
          description="This ephemeral link has expired or does not exist."
          noIndex={true}
        />
        <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-slate-400 mb-6 shadow-inner">
          <Ghost className="w-10 h-10 animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Link Vanished
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          This ephemeral link has either expired or never existed. All expired records are permanently erased from memory.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all"
          >
            <span>Create a New Ghost Link</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Passcode Protected View
  return (
    <div className="max-w-md mx-auto px-4 py-16 animate-fade-in">
      <SEO
        title="Passcode Protected Link"
        description="Enter passcode to unlock this ephemeral link."
        noIndex={true}
      />
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-md shadow-indigo-500/10">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Passcode Protected
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Enter the secret passcode to access this destination.
          </p>
        </div>

        {/* Expiry Pill */}
        <div className="mb-6 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>Expires: {new Date(metadata.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs sm:text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label htmlFor="passcode-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Secret Passcode
            </label>
            <div className="relative">
              <input
                id="passcode-input"
                type={showPasscode ? 'text' : 'password'}
                autoFocus
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode..."
                className="w-full pl-3.5 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={unlocking || !passcode.trim()}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
          >
            {unlocking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Unlock & Redirect</span>
                <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted with bcrypt verification</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RedirectPage;
