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
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-5">
          <KeyRound className="w-7 h-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
          Unlock Key Missing
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
          {cryptoError}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black transition-all"
          >
            <span>Return to Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
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
        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 flex items-center justify-center text-slate-400 mb-5 shadow-sm">
          <Ghost className="w-8 h-8 animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Link Vanished
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          This link has either reached its auto-eviction timer, self-destructed upon reading, or never existed. All records have been permanently cleared from memory.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black transition-all"
          >
            <span>Create New Link</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Secret Note Display View
  if (noteContent !== null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
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

  // Mission: Impossible Self-Destruct Countdown for Burned URLs
  if (burned && destinationUrl) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 animate-fade-in text-center">
        <SEO title="Link Destroyed" description="This link has self-destructed." noIndex={true} />
        <div className="stealth-card rounded-2xl p-6 sm:p-8 border border-rose-500/40 text-white space-y-5 bg-rose-950/70">
          <div className="w-14 h-14 mx-auto rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
            <Flame className="w-7 h-7 animate-bounce" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/30 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-300 mb-2">
              <span>Self-Destruct Triggered</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Link Destroyed Forever
            </h1>
            <p className="mt-1.5 text-xs text-rose-200/80 leading-relaxed">
              This link was set to <span className="font-bold text-white">burn on read</span>. It has been permanently purged from memory and cannot be accessed again.
            </p>
          </div>

          {/* Countdown Display */}
          <div className="py-2">
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-rose-400 animate-pulse">
              {burnCountdown}
            </div>
            <p className="text-[10px] text-rose-300/70 mt-1 uppercase font-mono tracking-wider">
              Seconds until automated redirect
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            <a
              href={destinationUrl}
              className="w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center justify-center gap-2 active:-translate-y-[1px]"
            >
              <span>Open Target Destination</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Target: <code className="text-slate-300">{destinationUrl}</code>
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
      <div className="stealth-card rounded-2xl p-6 sm:p-8 border border-slate-200/90 dark:border-white/10">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-3 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Passcode Protected
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enter the secret passcode to unlock this {fragmentType === 'note' ? 'secret note' : 'link'}.
          </p>
        </div>

        {/* Expiry and Burn Notice */}
        <div className="space-y-2 mb-5">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Expires: {new Date(metadata.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {metadata.views_remaining !== null && (
            <div className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 text-[11px] font-mono font-semibold ${
              metadata.views_remaining === 1
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}>
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {metadata.views_remaining === 1
                  ? 'Single-use link: Destroys upon unlocking'
                  : `${metadata.views_remaining} view(s) remaining before destruction`}
              </span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs animate-fade-in font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label htmlFor="passcode-input" className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
              Passcode
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
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/60 text-slate-900 dark:text-white text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={unlocking || !passcode.trim()}
            className="w-full py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider text-black bg-emerald-500 hover:bg-emerald-400 active:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center justify-center gap-2"
          >
            {unlocking ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Unlocking...</span>
              </>
            ) : (
              <>
                <span>Unlock {fragmentType === 'note' ? 'Secret Note' : 'Link'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-zinc-800 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted transmission: Ephemeral memory retention</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedirectPage;
