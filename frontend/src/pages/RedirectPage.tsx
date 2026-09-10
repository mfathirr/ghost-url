import React, { useEffect, useState, useCallback } from 'react';
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
  Flame,
  KeyRound,
} from 'lucide-react';
import { getLinkMetadata, unlockLink } from '../services/api';
import type { LinkMetadata } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEO } from '../components/SEO';
import { importKeyFromBase64, decrypt } from '../utils/crypto';
import { SecretNoteViewer } from '../components/SecretNoteViewer';

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

  // E2EE & Note Display states
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);
  const [burned, setBurned] = useState(false);
  const [burnCountdown, setBurnCountdown] = useState<number>(7);
  const [cryptoError, setCryptoError] = useState<string | null>(null);

  // Extract hash fragment parameters (#k=...&t=...&lang=...)
  const hash = typeof window !== 'undefined'
    ? (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash)
    : '';
  const hashParams = new URLSearchParams(hash);
  const fragmentKey = hashParams.get('k');
  const fragmentType = (hashParams.get('t') as 'url' | 'note' | null) || 'url';
  const noteLang = hashParams.get('lang') || 'auto';

  // Process unlocked raw payload (handles decryption if enc: prefixed)
  const processPayload = useCallback(async (rawPayload: string, isBurned: boolean) => {
    let finalPayload = rawPayload;

    if (rawPayload.startsWith('enc:')) {
      if (!fragmentKey) {
        setCryptoError('This secret is end-to-end encrypted, but the unlock key is missing from the link. Make sure you copied the entire URL including the secret key at the end.');
        return;
      }

      try {
        const cryptoKey = await importKeyFromBase64(fragmentKey);
        finalPayload = await decrypt(cryptoKey, rawPayload);
      } catch {
        setCryptoError('Could not unlock this secret. The key in your link might be incomplete or corrupted.');
        return;
      }
    }

    if (fragmentType === 'note') {
      // Ephemeral Secret Note
      setNoteContent(finalPayload);
      setBurned(isBurned);
    } else {
      // Destination URL
      if (isBurned) {
        // Dramatic self-destruct countdown before proceeding
        setDestinationUrl(finalPayload);
        setBurned(true);
      } else {
        setRedirecting(true);
        window.location.replace(finalPayload);
      }
    }
  }, [fragmentKey, fragmentType]);

  // Countdown timer for burned URL links
  useEffect(() => {
    if (!burned || !destinationUrl) return;

    const timer = setInterval(() => {
      setBurnCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.replace(destinationUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [burned, destinationUrl]);

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

        // If link is not protected by passcode, unlock immediately
        if (!meta.protected) {
          const res = await unlockLink(slug, '');
          await processPayload(res.url, !!res.burned);
          return;
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    checkLink();
  }, [slug, processPayload]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;

    if (!passcode.trim()) {
      setErrorMessage('Please enter the password to unlock this link');
      return;
    }

    try {
      setUnlocking(true);
      setErrorMessage(null);
      const res = await unlockLink(slug, passcode.trim());
      await processPayload(res.url, !!res.burned);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Incorrect password. Please try again.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (loading || redirecting) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <SEO
          title={redirecting ? 'Opening Link...' : 'Verifying Link'}
          description="Verifying ephemeral link destination."
          noIndex={true}
        />
        <LoadingSpinner message={redirecting ? 'Access granted. Opening your destination...' : 'Verifying private link...'} />
      </div>
    );
  }

  // Missing or Invalid Key Fragment Screen
  if (cryptoError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center animate-fade-in">
        <SEO title="Unlock Key Missing" description="Secret key missing from link." noIndex={true} />
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-500 mb-6 shadow-md shadow-amber-500/10">
          <KeyRound className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Unlock Key Missing
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {cryptoError}
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all"
          >
            <span>Go to GhostURL</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Expired or Not Found State
  if (notFound || !metadata) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center animate-fade-in">
        <SEO
          title="Link Expired or Vanished"
          description="This private link has expired or does not exist."
          noIndex={true}
        />
        <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-slate-400 mb-6 shadow-inner">
          <Ghost className="w-10 h-10 animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Link Vanished
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          This link has either expired, self-destructed upon reading, or never existed. All records have been permanently wiped from memory.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all"
          >
            <span>Create a New Link</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Secret Note Display View
  if (noteContent !== null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <SEO title="Secret Note" description="View private secret note." noIndex={true} />
        <SecretNoteViewer
          content={noteContent}
          language={noteLang}
          burned={burned}
          expiresAt={metadata.expires_at}
        />
      </div>
    );
  }

  // Dramatic Mission: Impossible Self-Destruct Countdown for Burned URLs
  if (burned && destinationUrl) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 animate-fade-in text-center">
        <SEO title="Link Destroyed" description="This link has self-destructed." noIndex={true} />
        <div className="bg-gradient-to-b from-rose-950/90 to-slate-950/90 border border-rose-500/40 rounded-3xl p-8 shadow-2xl shadow-rose-950/60 backdrop-blur-xl text-white space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
            <Flame className="w-10 h-10 animate-bounce" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-xs font-bold uppercase tracking-wider text-rose-300 mb-3">
              <span>Self-Destruct Activated</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Link Destroyed Forever
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-rose-200/80 leading-relaxed">
              This link was set to <span className="font-bold text-white">self-destruct after opening</span>. It has been permanently deleted from our system and cannot be opened again.
            </p>
          </div>

          {/* Countdown Ring / Display */}
          <div className="py-4">
            <div className="text-5xl font-black font-mono tracking-wider text-rose-400 animate-pulse">
              {burnCountdown}
            </div>
            <p className="text-xs text-rose-300/70 mt-1 uppercase font-semibold tracking-wider">
              Seconds until redirect
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={destinationUrl}
              className="w-full py-3.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>Open Destination Now</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <div className="text-[11px] text-slate-400">
              Destination: <code className="font-mono text-slate-300 break-all">{destinationUrl}</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Passcode Protected View
  return (
    <div className="max-w-md mx-auto px-4 py-16 animate-fade-in">
      <SEO
        title="Password Protected Link"
        description="Enter password to unlock this private link."
        noIndex={true}
      />
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-md shadow-indigo-500/10">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Password Protected
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Enter the password to unlock this {fragmentType === 'note' ? 'secret note' : 'link'}.
          </p>
        </div>

        {/* Expiry and Burn Notice */}
        <div className="space-y-2 mb-6">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Expires: {new Date(metadata.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {metadata.views_remaining !== null && (
            <div className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold ${
              metadata.views_remaining === 1
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'
            }`}>
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {metadata.views_remaining === 1
                  ? '⚠️ Single-use link: Self-destructs upon unlocking'
                  : `🔥 ${metadata.views_remaining} opens remaining before self-destructing`}
              </span>
            </div>
          )}
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
              Password
            </label>
            <div className="relative">
              <input
                id="passcode-input"
                type={showPasscode ? 'text' : 'password'}
                autoFocus
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter password..."
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
                <span>Unlocking...</span>
              </>
            ) : (
              <>
                <span>Unlock {fragmentType === 'note' ? 'Secret Note' : 'Link'}</span>
                <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Private, encrypted, and automatically destroyed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedirectPage;

