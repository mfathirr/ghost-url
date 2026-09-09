import React, { useState } from 'react';
import { Copy, Check, X, Globe, FileText, ArrowUpRight } from 'lucide-react';
import type { IncomingTransfer } from '../types/p2p';

interface IncomingModalProps {
  transfer: IncomingTransfer | null;
  onDismiss: () => void;
}

export const IncomingModal: React.FC<IncomingModalProps> = ({ transfer, onDismiss }) => {
  const [copied, setCopied] = useState(false);

  if (!transfer) return null;

  const isLink = transfer.type === 'link' || /^https?:\/\//i.test(transfer.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transfer.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpen = () => {
    if (isLink) {
      window.open(transfer.content, '_blank', 'noopener,noreferrer');
      onDismiss();
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-slide-up">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Ambient top highlight */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-10 bg-indigo-500/20 blur-2xl rounded-full pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
              {isLink ? <Globe className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Nearby Device Sharing
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                <span className="text-indigo-600 dark:text-indigo-400">{transfer.senderName}</span> sent you a link
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box */}
        <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-5 break-all max-h-36 overflow-y-auto">
          <p className="text-sm font-mono text-slate-800 dark:text-indigo-300 select-all">
            {transfer.content}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isLink && (
            <button
              type="button"
              onClick={handleOpen}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20 transition-all duration-200 active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Accept & Open</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm border transition-all duration-200 ${
              copied
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="py-3 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};
