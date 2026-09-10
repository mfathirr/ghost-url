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
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useP2PContext } from '../context/P2PContext';
import { PeerAvatarWithProgress } from '../components/PeerAvatarWithProgress';
import type { PeerInfo } from '../types/p2p';
import { copyToClipboard } from '../utils/clipboard';
import { SEO } from '../components/SEO';

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
}

export const CreatedPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CreatedState | null;

  const [copied, setCopied] = useState(false);
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
    if (totalSeconds <= 0) return 'Expired';
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
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16 animate-fade-in">
      <SEO
        title={state.content_type === 'note' ? 'Secret Note Created' : 'Disappearing Link Created'}
        description="Your private link is ready to share. It will automatically self-destruct once expired or read."
        noIndex={true}
      />

      {/* Success Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
          {state.content_type === 'note' ? (
            <FileText className="w-8 h-8 text-amber-500" />
          ) : (
            <ShieldCheck className="w-8 h-8" />
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          {state.content_type === 'note' ? 'Secret Note is Ready' : 'Disappearing Link is Ready'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {state.content_type === 'note'
            ? 'Share this encrypted secret note. It unlocks only in your recipient’s browser.'
            : 'Share this private link. It will automatically self-destruct once expired or viewed.'}
        </p>
      </div>

      {/* Main Result Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
        {/* Security & Feature Badges */}
        {(state.fragment_key || (state.max_views && state.max_views > 0)) && (
          <div className="space-y-2.5">
            {state.fragment_key && (
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/90 dark:border-indigo-800/70 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">End-to-End Encrypted: </span>
                  The secret key is included in your link and never touches our servers. Only someone with the complete link can view it.
                </div>
              </div>
            )}
            {state.max_views && state.max_views > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/90 dark:border-rose-800/70 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
                <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {state.max_views === 1 ? 'Self-Destruct Active: ' : `Self-Destruct Limit (${state.max_views} Views): `}
                  </span>
                  {state.max_views === 1
                    ? 'This link will disappear forever the moment it is opened.'
                    : `This link will automatically self-destruct after ${state.max_views} view(s).`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Short URL Copy Box */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Your Private {state.content_type === 'note' ? 'Secret Note' : 'Short'} Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-indigo-300 font-mono text-sm sm:text-base font-semibold truncate select-all">
              {visitableShortUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`px-5 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 flex-shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expiry & Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Expiration Timer */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/70 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Expires In</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                {formatCountdown(secondsRemaining)}
              </div>
            </div>
          </div>

          {/* Access Control */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
              state.has_passcode
                ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}>
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Password</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {state.has_passcode ? 'Protected' : 'None (Open)'}
              </div>
            </div>
          </div>

          {/* Burn / View Limit */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
              state.max_views && state.max_views > 0
                ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Self-Destruct</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {state.max_views && state.max_views > 0
                  ? state.max_views === 1 ? '1 View (Self-destruct)' : `${state.max_views} Views`
                  : 'When timer expires'}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <QrCode className="w-4 h-4 text-indigo-500" />
              <span>QR Code for Mobile Access</span>
            </h2>
            <button
              onClick={downloadQR}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>
          </div>
          <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="p-4 rounded-2xl bg-white shadow-md">
              <QRCodeSVG
                id="ghost-qr-code"
                value={visitableShortUrl}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
              Scan with any phone camera to open directly on mobile.
            </p>
          </div>
        </div>

        {/* Original URL Preview */}
        {state.original_url && (
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Destination: </span>
            <span className="font-mono text-slate-700 dark:text-slate-300 break-all">
              {state.original_url}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <a
            href={visitableShortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold text-center flex items-center justify-center gap-2 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Link in New Tab</span>
          </a>

          <Link
            to="/"
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold text-center flex items-center justify-center gap-2 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Another Link</span>
          </Link>
        </div>

        {/* Nearby Share Section */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Radio className="w-4 h-4 text-indigo-500" />
              <span>Share to Nearby Device</span>
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-500'
                    : wsStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
                }`}
              />
              <span className="flex items-center gap-1.5">
                <span>
                  {wsStatus === 'connected'
                    ? peers.length > 0
                      ? `${peers.length} peer${peers.length !== 1 ? 's' : ''} online`
                      : 'Searching for peers...'
                    : wsStatus === 'connecting'
                    ? 'Connecting radar...'
                    : 'Radar offline'}
                </span>
                {wsStatus !== 'connected' && wsStatus !== 'connecting' && (
                  <button
                    type="button"
                    onClick={reconnect}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    (Retry)
                  </button>
                )}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Directly beam this ghost link to nearby devices. Click any device below to send instantly.
          </p>

          {/* Sent feedback banner */}
          {lastSentPeerName && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-medium">✓ Sent to {lastSentPeerName}!</span>
            </div>
          )}

          {peers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {peers.map((peer) => (
                <PeerAvatarWithProgress
                  key={peer.id}
                  peer={peer}
                  progress={null}
                  isSent={!!sentTo[peer.id]}
                  isSending={!!sendingTo[peer.id]}
                  actionLabel="Send Link"
                  onClick={() => handleSendToPeer(peer)}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {wsStatus === 'connected'
                  ? "No nearby devices detected on your local network. Open GhostURL on another device or tab to share."
                  : wsStatus === 'connecting'
                  ? "Connecting to nearby device network..."
                  : "Radar is offline. Ensure VITE_WS_URL or VITE_API_BASE_URL is set in Vercel project settings and redeployed."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatedPage;
