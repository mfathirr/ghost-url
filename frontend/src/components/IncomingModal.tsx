import React, { useState } from 'react';
import {
  Copy,
  Check,
  X,
  Globe,
  FileText,
  ArrowUpRight,
  Download,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileArchive,
  Loader2,
} from 'lucide-react';
import type { IncomingTransfer, FileTransferProgress } from '../types/p2p';
import { formatBytes } from './GhostDropZone';

function getFileTypeIcon(type: string, name: string) {
  const lowerType = (type || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();

  if (lowerType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) {
    return <ImageIcon className="w-8 h-8 text-violet-500" />;
  }
  if (lowerType.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(lowerName)) {
    return <Video className="w-8 h-8 text-rose-500" />;
  }
  if (lowerType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(lowerName)) {
    return <Music className="w-8 h-8 text-amber-500" />;
  }
  if (
    lowerType.includes('zip') ||
    lowerType.includes('compressed') ||
    /\.(zip|tar|gz|7z|rar)$/i.test(lowerName)
  ) {
    return <FileArchive className="w-8 h-8 text-emerald-500" />;
  }
  if (lowerType.includes('text') || lowerType.includes('pdf') || /\.(pdf|txt|md|doc|docx)$/i.test(lowerName)) {
    return <FileText className="w-8 h-8 text-indigo-500" />;
  }
  return <File className="w-8 h-8 text-slate-400" />;
}

interface IncomingModalProps {
  transfer: IncomingTransfer | null;
  onDismiss: () => void;
  onAcceptFile?: () => void;
  onRejectFile?: () => void;
  incomingProgress?: FileTransferProgress | null;
}

export const IncomingModal: React.FC<IncomingModalProps> = ({
  transfer,
  onDismiss,
  onAcceptFile,
  onRejectFile,
  incomingProgress,
}) => {
  const [copied, setCopied] = useState(false);

  if (!transfer) return null;

  const isFileOffer = transfer.type === 'file-offer' && !!transfer.fileOffer;
  const isLink = transfer.type === 'link' || (!isFileOffer && /^https?:\/\//i.test(transfer.content));
  const isTransferring = !!incomingProgress;

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

  const handleDecline = () => {
    if (isFileOffer && onRejectFile) {
      onRejectFile();
    } else {
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
              {isFileOffer ? (
                <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              ) : isLink ? (
                <Globe className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {isFileOffer ? 'Incoming GhostDrop' : 'Nearby Device Sharing'}
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                <span className="text-indigo-600 dark:text-indigo-400">{transfer.senderName}</span>{' '}
                {isFileOffer ? 'wants to send a file' : isLink ? 'sent you a link' : 'sent text'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDecline}
            disabled={isTransferring}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box or File Preview */}
        {isFileOffer && transfer.fileOffer ? (
          <div className="mb-5 space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                {getFileTypeIcon(transfer.fileOffer.fileType, transfer.fileOffer.fileName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {transfer.fileOffer.fileName}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatBytes(transfer.fileOffer.fileSize)}
                  </span>
                  <span>•</span>
                  <span className="truncate">{transfer.fileOffer.fileType || 'Unknown type'}</span>
                </div>
              </div>
            </div>

            {/* In-progress streaming bar */}
            {isTransferring && incomingProgress && (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {incomingProgress.chunksTransferred === 0
                        ? 'Preparing transfer...'
                        : `Streaming direct (${formatBytes(Math.min(incomingProgress.fileSize, incomingProgress.chunksTransferred * 16384))} / ${formatBytes(incomingProgress.fileSize)})`}
                    </span>
                  </span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {incomingProgress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.max(2, incomingProgress.percentage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-5 break-all max-h-36 overflow-y-auto">
            <p className="text-sm font-mono text-slate-800 dark:text-indigo-300 select-all">
              {transfer.content}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isFileOffer ? (
            !isTransferring ? (
              <>
                <button
                  type="button"
                  onClick={onAcceptFile}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20 transition-all duration-200 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Accept & Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  className="py-3 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  Decline
                </button>
              </>
            ) : (
              <div className="w-full text-center py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                Downloading directly into browser memory...
              </div>
            )
          ) : (
            <>
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
                onClick={handleDecline}
                className="py-3 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                Decline
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomingModal;
