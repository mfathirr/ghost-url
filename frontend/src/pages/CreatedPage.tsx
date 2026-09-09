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
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface CreatedState {
  slug: string;
  short_url: string;
  expires_at: string;
  ttl_seconds: number;
  has_passcode: boolean;
  original_url?: string;
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

  // For visitors and QR code: construct full URL based on current origin and slug
  const visitableShortUrl = `${window.location.origin}/r/${state.slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(visitableShortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
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
      {/* Success Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Ghost Link is Live
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Share this ephemeral link. It will automatically self-destruct once expired.
        </p>
      </div>

      {/* Main Result Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
        {/* Short URL Copy Box */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Your Short URL
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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

          {/* Passcode Protection Status */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
              state.has_passcode
                ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}>
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Access Control</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {state.has_passcode ? 'Passcode Protected' : 'Open Access'}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <QrCode className="w-4 h-4 text-indigo-500" />
              <span>QR Code for Mobile Access</span>
            </div>
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
              Scan with any mobile camera to open this ghost link.
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
            <span>Test Link in New Tab</span>
          </a>

          <Link
            to="/"
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold text-center flex items-center justify-center gap-2 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Another Link</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
export default CreatedPage;
