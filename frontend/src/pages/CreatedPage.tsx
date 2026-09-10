import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Check,
  Copy,
  Clock,
  KeyRound,
  ExternalLink,
  PlusCircle,
  QrCode,
  ShieldCheck,
  Download,
  Radio,
  Lock,
  Flame,
  FileText,
  FileCheck2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useP2PContext } from '../context/P2PContext';
import { PeerAvatarWithProgress } from '../components/PeerAvatarWithProgress';
import type { PeerInfo } from '../types/p2p';
import { copyToClipboard } from '../utils/clipboard';
import { SEO } from '../components/SEO';
import { useTranslation } from '../hooks/useTranslation';

interface CreatedState {
  slug: string;
  short_url: string;
  expires_at: string;
  ttl_seconds: number;
  has_passcode: boolean;
  original_url?: string;
  fragment_key?: string;
  content_type?: 'url' | 'note';
  note_language?: string;
  max_views?: number;
  status_token?: string;
}

export const CreatedPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CreatedState | null;

  const [copied, setCopied] = useState(false);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!state?.expires_at) return 0;
    const diff = Math.max(0, Math.floor((new Date(state.expires_at).getTime() - Date.now()) / 1000));
    return diff;
  });

  // Global P2P Context
  const {
    wsStatus,
    peers,
    sendToPeer,
    reconnect,
  } = useP2PContext();

  const [sendingTo, setSendingTo] = useState<Record<string, boolean>>({});
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [lastSentPeerName, setLastSentPeerName] = useState<string | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/', { replace: true });
      return;
    }

    // Save to local receipts storage if status_token present
    if (state.status_token) {
      try {
        const stored = localStorage.getItem('ghost_receipts');
        const list = stored ? JSON.parse(stored) : [];
        if (!list.some((item: { slug: string }) => item.slug === state.slug)) {
          list.unshift({
            slug: state.slug,
            status_token: state.status_token,
            created_at: new Date().toISOString(),
            expires_at: state.expires_at,
            content_type: state.content_type || 'url',
          });
          localStorage.setItem('ghost_receipts', JSON.stringify(list.slice(0, 25)));
        }
      } catch {
        // ignore
      }
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state, navigate]);

  if (!state) {
    return null;
  }

  // For visitors, QR code and P2P: construct full URL based on current origin, slug, and hash fragment
  let fragment = '';
  if (state.fragment_key) {
    fragment = `#k=${state.fragment_key}&t=${state.content_type || 'url'}`;
    if (state.note_language && state.note_language !== 'auto') {
      fragment += `&lang=${encodeURIComponent(state.note_language)}`;
    }
  }
  const visitableShortUrl = `${window.location.origin}/r/${state.slug}${fragment}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(visitableShortUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendToPeer = async (peer: PeerInfo) => {
    if (sendingTo[peer.id]) return;
    setSendingTo((prev) => ({ ...prev, [peer.id]: true }));
    try {
      const ok = await sendToPeer(peer.id, visitableShortUrl);
      if (ok) {
        setSentTo((prev) => ({ ...prev, [peer.id]: true }));
        setLastSentPeerName(peer.name);
        setTimeout(() => {
          setSentTo((prev) => {
            const next = { ...prev };
            delete next[peer.id];
            return next;
          });
          setLastSentPeerName(null);
        }, 2000);
      }
    } finally {
      setSendingTo((prev) => ({ ...prev, [peer.id]: false }));
    }
  };

  const formatCountdown = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return t('errors.expiredOrBurned');
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const downloadQR = () => {
    const svg = document.getElementById('ghost-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const a = document.createElement('a');
        a.download = `ghost-url-${state.slug}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 animate-fade-in">
      <SEO
        title={state.content_type === 'note' ? 'Secret Note Created' : 'Disappearing Link Created'}
        description="Your private link is ready to share. It will automatically self-destruct once expired or read."
        noIndex={true}
      />

      {/* Success Readout */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 mb-3 shadow-sm">
          {state.content_type === 'note' ? (
            <FileText className="w-6 h-6" />
          ) : (
            <ShieldCheck className="w-6 h-6" />
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t('created.title')}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {t('created.subtitle')}
        </p>
      </div>

      {/* Main Result Card */}
      <div className="stealth-card rounded-2xl p-5 sm:p-7 border border-slate-200/90 dark:border-white/10 space-y-5">
        {/* Security & Feature Badges */}
        {(state.fragment_key || (state.max_views && state.max_views > 0)) && (
          <div className="space-y-2">
            {state.fragment_key && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs font-mono text-emerald-700 dark:text-emerald-300">
                <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  {t('created.e2eeActiveNotice')}
                </div>
              </div>
            )}
            {state.max_views && state.max_views > 0 && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs font-mono text-rose-700 dark:text-rose-300">
                <Flame className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {state.max_views === 1 ? `${t('created.burnOn1stRead').toUpperCase()}: ` : ''}
                  </span>
                  {state.max_views === 1
                    ? t('created.burnNotice')
                    : t('created.viewLimitNotice', { count: state.max_views })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Short URL Copy Box */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
            {t('created.copyLink')}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-emerald-300 font-mono text-xs sm:text-sm font-semibold truncate select-all">
              {visitableShortUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 flex-shrink-0 active:-translate-y-[1px] ${
                copied
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('created.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('created.copyLink')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expiry & Status Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Expiration Timer */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">{t('status.expiresAt')}</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                {formatCountdown(secondsRemaining)}
              </div>
            </div>
          </div>

          {/* Access Control */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 flex-shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">{t('created.accessPasscode')}</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                {state.has_passcode ? t('created.passcodeBcrypt') : t('created.passcodeOpen')}
              </div>
            </div>
          </div>

          {/* Burn / View Limit */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 flex-shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">{t('created.destructionRule')}</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                {state.max_views && state.max_views > 0
                  ? state.max_views === 1 ? t('created.burnOn1stRead') : t('created.viewsAllowedPlural', { count: state.max_views })
                  : t('created.onTimerEviction')}
              </div>
            </div>
          </div>
        </div>

        {/* Zero-Knowledge Delivery Status Receipt Box */}
        {state.status_token && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <FileCheck2 className="w-4 h-4 text-emerald-500" />
                <span>{t('created.zkDeliveryReceipt')}</span>
              </div>
              <Link
                to={`/status/${state.slug}#token=${state.status_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>{t('created.liveReceiptLink')}</span>
              </Link>
            </div>
            <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 leading-relaxed">
              {t('created.zkReceiptDesc')}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-white/60 dark:bg-black/50 text-[11px] font-mono text-slate-600 dark:text-emerald-300/90 truncate select-all">
                {`${window.location.origin}/status/${state.slug}#token=${state.status_token}`}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const auditUrl = `${window.location.origin}/status/${state.slug}#token=${state.status_token}`;
                  const ok = await copyToClipboard(auditUrl);
                  if (ok) {
                    setReceiptCopied(true);
                    setTimeout(() => setReceiptCopied(false), 2000);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shrink-0"
              >
                {receiptCopied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>{t('created.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t('created.copyReceiptLink')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* QR Code Section */}
        <div className="border-t border-slate-200/70 dark:border-zinc-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-1.5 text-xs font-mono uppercase font-bold text-slate-800 dark:text-slate-200">
              <QrCode className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('created.mobileQrCode')}</span>
            </h2>
            <button
              onClick={downloadQR}
              className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>{t('created.downloadPng')}</span>
            </button>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/40">
            <div className="p-3 rounded-xl bg-white shadow-sm">
              <QRCodeSVG
                id="ghost-qr-code"
                value={visitableShortUrl}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-2.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 text-center">
              {t('created.scanMobileCamera')}
            </p>
          </div>
        </div>

        {/* Original Destination Preview */}
        {state.original_url && (
          <div className="border-t border-slate-200/70 dark:border-zinc-800 pt-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{t('created.targetLabel')}</span>
            <span className="break-all">{state.original_url}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <a
            href={visitableShortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-800 dark:text-white text-xs font-mono font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t('created.openInNewTab')}</span>
          </a>

          <Link
            to="/"
            className="flex-1 py-2.5 px-3 rounded-lg border border-transparent bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-white text-xs font-mono font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('created.createAnother')}</span>
          </Link>
        </div>

        {/* Nearby P2P Share Section */}
        <div className="border-t border-slate-200/70 dark:border-zinc-800 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-1.5 text-xs font-mono uppercase font-bold text-slate-800 dark:text-slate-200">
              <Radio className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('created.beamToNearby')}</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-500'
                    : wsStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
                }`}
              />
              <span>
                {wsStatus === 'connected'
                  ? peers.length > 0
                    ? peers.length === 1
                      ? t('created.peersInRange', { count: peers.length })
                      : t('created.peersInRangePlural', { count: peers.length })
                    : t('created.searchingPeers')
                  : wsStatus === 'connecting'
                  ? t('created.connectingRadar')
                  : t('created.radarOffline')}
              </span>
              {wsStatus !== 'connected' && wsStatus !== 'connecting' && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="text-emerald-500 hover:underline font-semibold ml-1"
                >
                  {t('created.retryBtn')}
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-3">
            {t('created.beamDirectlyHint')}
          </p>

          {/* Feedback banner */}
          {lastSentPeerName && (
            <div className="mb-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{t('created.beamedToPeer', { name: lastSentPeerName })}</span>
            </div>
          )}

          {peers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {peers.map((peer) => (
                <PeerAvatarWithProgress
                  key={peer.id}
                  peer={peer}
                  progress={null}
                  isSent={!!sentTo[peer.id]}
                  isSending={!!sendingTo[peer.id]}
                  actionLabel={t('created.beamLinkBtn')}
                  onClick={() => handleSendToPeer(peer)}
                />
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/30 text-center">
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {wsStatus === 'connected'
                  ? t('created.noNearbyDevices')
                  : wsStatus === 'connecting'
                  ? t('created.connectingHub')
                  : t('created.radarOffline')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatedPage;
