import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  KeyRound,
  FileCheck2,
} from 'lucide-react';
import { getDeliveryStatus } from '../services/api';
import type { StatusReceipt } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEO } from '../components/SEO';
import { useTranslation } from '../hooks/useTranslation';

export const StatusPage: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();

  const [receipt, setReceipt] = useState<StatusReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Extract token from #token=... fragment (preferred for zero-knowledge) or ?token=... query
  const getTokenFromUrl = () => {
    if (typeof window === 'undefined') return '';
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const fromHash = hashParams.get('token');
    if (fromHash) return fromHash;

    const queryParams = new URLSearchParams(window.location.search);
    return queryParams.get('token') || '';
  };

  const fetchStatus = async (token: string) => {
    if (!slug || !token) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await getDeliveryStatus(slug, token);
      setReceipt(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('errors.genericError'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const token = getTokenFromUrl();
    if (token) {
      fetchStatus(token);
    } else {
      // Check if we have this token in localStorage
      try {
        const stored = localStorage.getItem('ghost_receipts');
        if (stored) {
          const list = JSON.parse(stored);
          const match = Array.isArray(list) ? list.find((item: { slug: string; status_token?: string }) => item.slug === slug) : null;
          if (match && match.status_token) {
            fetchStatus(match.status_token);
            return;
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
  }, [slug]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setLoading(true);
    fetchStatus(manualToken.trim());
  };

  const handleRefresh = () => {
    const token = getTokenFromUrl() || manualToken.trim();
    if (token) {
      setRefreshing(true);
      fetchStatus(token);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <SEO title={t('status.title')} description={t('status.subtitle')} noIndex={true} />
        <LoadingSpinner message={t('unlock.verifyingLink')} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12 sm:py-16 animate-fade-in">
      <SEO title="Delivery Receipt" description="Zero-knowledge delivery status receipt." noIndex={true} />

      <div className="stealth-card rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-white/10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-sm">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                <span>{t('status.zkReceiptBadge')}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t('status.title')}
              </h1>
            </div>
          </div>

          {receipt && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={t('status.refresh')}
              title={t('status.refresh')}
              className="p-2 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Slug details badge */}
        <div className="p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-black/40 flex items-center justify-between font-mono text-xs">
          <span className="text-slate-500 dark:text-zinc-400">{t('status.targetSlug')}</span>
          <code className="text-emerald-600 dark:text-emerald-400 font-bold">{slug}</code>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Token Input Form if token missing or invalid */}
        {!receipt && (
          <form onSubmit={handleManualSubmit} className="space-y-4 pt-2">
            <div>
              <label htmlFor="token-input" className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                {t('status.senderTokenLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <input
                  id="token-input"
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder={t('status.enterTokenPlaceholder')}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2"
            >
              <span>{t('status.refresh')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Verified Receipt Timeline */}
        {receipt && (
          <div className="space-y-6 pt-2">
            {/* Status Hero Card */}
            <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
              receipt.status === 'burned'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                : receipt.status === 'viewed'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}>
              {receipt.status === 'burned' ? (
                <Flame className="w-6 h-6 text-rose-500 shrink-0" />
              ) : receipt.status === 'viewed' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              ) : (
                <Clock className="w-6 h-6 text-amber-500 shrink-0 animate-pulse" />
              )}
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider">
                  {receipt.status === 'burned'
                    ? t('status.stateBurned')
                    : receipt.status === 'viewed'
                    ? t('status.stateViewed')
                    : t('status.statePending')}
                </div>
                <div className="text-xs mt-0.5 opacity-80 font-mono">
                  {receipt.status === 'burned'
                    ? t('status.stateBurnedDesc')
                    : receipt.status === 'viewed'
                    ? t('status.stateViewedDesc')
                    : t('status.statePendingDesc')}
                </div>
              </div>
            </div>

            {/* Lifecycle Timeline */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
              {/* Step 1: Created */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900" />
                <div className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {t('status.createdAt')}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                  {new Date(receipt.created_at).toLocaleString()}
                </div>
              </div>

              {/* Step 2: Viewed */}
              <div className="relative">
                <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-zinc-900 ${
                  receipt.viewed_at ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
                }`} />
                <div className={`text-xs font-mono font-semibold ${
                  receipt.viewed_at ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-zinc-600'
                }`}>
                  {t('status.viewedAt')}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                  {receipt.viewed_at ? new Date(receipt.viewed_at).toLocaleString() : t('status.pendingReceiptText')}
                </div>
              </div>

              {/* Step 3: Burned */}
              <div className="relative">
                <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-zinc-900 ${
                  receipt.burned_at ? 'bg-rose-500' : 'bg-slate-300 dark:bg-zinc-700'
                }`} />
                <div className={`text-xs font-mono font-semibold ${
                  receipt.burned_at ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-zinc-600'
                }`}>
                  {t('status.burnedAt')}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                  {receipt.burned_at
                    ? new Date(receipt.burned_at).toLocaleString()
                    : t('status.scheduledExpiry', { time: new Date(receipt.expires_at).toLocaleTimeString() })}
                </div>
              </div>
            </div>

            {/* Privacy Invariant Note */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-500 dark:text-zinc-400 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{t('status.zeroTrackingGuarantee')}</span>
            </div>
          </div>
        )}

        <div className="border-t border-slate-200/80 dark:border-zinc-800 pt-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            <span>&larr; {t('notFound.homeBtn')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
