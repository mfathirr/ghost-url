import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  X,
  Globe,
  FileText,
  ArrowUpRight,
  Download,
  File as LucideFile,
  Image as ImageIcon,
  Video,
  Music,
  FileArchive,
  Loader2,
  Film,
  Smartphone,
} from 'lucide-react';
import type { IncomingTransfer, FileTransferProgress } from '../types/p2p';
import { formatBytes } from './GhostDropZone';
import { soundFx } from '../utils/soundEngine';
import { useTranslation } from '../hooks/useTranslation';

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
    return <FileText className="w-8 h-8 text-emerald-500" />;
  }
  return <LucideFile className="w-8 h-8 text-slate-400" />;
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
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
    setSaved(false);
  }, [transfer?.completedDownload?.url]);

  if (!transfer) return null;

  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const isCompleted = !!transfer.completedDownload;
  const isFileOffer = (transfer.type === 'file-offer' && !!transfer.fileOffer) || isCompleted;
  const isLink = transfer.type === 'link' || (!isFileOffer && /^https?:\/\//i.test(transfer.content));
  const isTransferring = !!incomingProgress && !isCompleted;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transfer.content);
      soundFx.playCopySuccess();
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
    if (isFileOffer && onRejectFile && !isCompleted) {
      onRejectFile();
    } else {
      onDismiss();
    }
  };

  const handleSaveFile = async () => {
    if (!transfer.completedDownload) return;
    const { url, fileName, fileType, blob } = transfer.completedDownload;

    // 1. If Web Share API is available with file support (e.g. Safari iOS 15+), try native share sheet
    if (blob && typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const file = new File([blob], fileName, { type: fileType || 'application/octet-stream' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
          });
          setSaved(true);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return; // User cancelled share sheet
        }
        console.warn('[P2P] Web Share API failed, falling back to anchor download:', err);
      }
    }

    // 2. Direct anchor download via trusted user gesture
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSaved(true);
    } catch (err) {
      console.error('[P2P] Download trigger failed:', err);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-slide-up font-sans">
      <div className="stealth-card rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-white/10 shadow-2xl relative overflow-hidden">
        {/* Ambient top highlight */}
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-10 blur-2xl rounded-full pointer-events-none ${
            isCompleted ? 'bg-emerald-500/20' : 'bg-emerald-500/10'
          }`}
        />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${
                isCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800/70 text-emerald-600 dark:text-emerald-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : isFileOffer ? (
                <Download className="w-5 h-5 text-emerald-500" />
              ) : isLink ? (
                <Globe className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {isCompleted
                    ? t('incomingModal.transferComplete')
                    : isFileOffer
                    ? t('incomingModal.incomingGhostDrop')
                    : t('incomingModal.nearbySharing')}
                </span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isCompleted ? 'bg-emerald-500' : 'bg-emerald-500 animate-ping'
                  }`}
                />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {transfer.senderName}
                </span>{' '}
                {isCompleted
                  ? t('incomingModal.beamedYouFile')
                  : isFileOffer
                  ? t('incomingModal.wantsToSendFile')
                  : isLink
                  ? t('incomingModal.sentYouLink')
                  : t('incomingModal.sentText')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDecline}
            disabled={isTransferring}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            title={t('common.dismiss')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box or File Preview */}
        {isCompleted && transfer.completedDownload ? (
          <div className="mb-5 space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                {getFileTypeIcon(transfer.completedDownload.fileType, transfer.completedDownload.fileName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {transfer.completedDownload.fileName}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatBytes(transfer.completedDownload.fileSize)}
                  </span>
                  <span>•</span>
                  <span className="truncate">{transfer.completedDownload.fileType || t('incomingModal.readyToSave')}</span>
                </div>
              </div>
            </div>

            {/* Inline video player preview or format card */}
            {(() => {
              const fileName = transfer.completedDownload.fileName;
              const fileType = (transfer.completedDownload.fileType || '').toLowerCase();
              const isVideo =
                fileType.startsWith('video/') ||
                /\.(mov|mp4|webm|m4v|mkv)$/i.test(fileName);
              const isAppleQuickTime =
                /\.mov$/i.test(fileName) ||
                fileType === 'video/quicktime';

              if (!isVideo) {
                return (
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{t('incomingModal.readyInMemory')}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {/* Video preview or QuickTime format card */}
                  {(isAppleQuickTime && isIOS) || videoError ? (
                    <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-2.5 py-6 shadow-inner relative overflow-hidden">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 shadow-sm relative z-10">
                        <Film className="w-6 h-6" />
                      </div>
                      <div className="space-y-1 relative z-10">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                          <span>{t('incomingModal.appleVideoTitle')}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 font-mono">
                            {fileName.split('.').pop()?.toUpperCase() || 'MOV'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                          {t('incomingModal.appleVideoDesc')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden bg-black aspect-video max-h-48 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-inner">
                      <video
                        src={transfer.completedDownload.url}
                        controls
                        playsInline
                        preload="metadata"
                        onError={() => setVideoError(true)}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Guidance Box */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{t('incomingModal.beamedIntact')}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        {t('incomingModal.readyBadge')}
                      </span>
                    </div>

                    {isIOS ? (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                          <Smartphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{t('incomingModal.howToPlayIos')}</span>
                        </div>
                        <ol className="list-decimal list-inside text-[11px] text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed pl-0.5">
                          <li>{t('incomingModal.iosStep1')}</li>
                          <li>{t('incomingModal.iosStep2', { fileName })}</li>
                          <li>{t('incomingModal.iosStep3')}</li>
                        </ol>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5 border-t border-amber-500/20">
                          {t('incomingModal.iosNote')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-1">
                        {t('incomingModal.desktopVideoHelp')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : isFileOffer && transfer.fileOffer ? (
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
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatBytes(transfer.fileOffer.fileSize)}
                  </span>
                  <span>•</span>
                  <span className="truncate">{transfer.fileOffer.fileType || t('dropZone.binaryFile')}</span>
                </div>
              </div>
            </div>

            {/* In-progress streaming bar */}
            {isTransferring && incomingProgress && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('incomingModal.streamingMemory')}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {incomingProgress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                    style={{ width: `${incomingProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-5 break-all max-h-36 overflow-y-auto">
            <p className="text-sm font-mono text-slate-800 dark:text-emerald-300 select-all">
              {transfer.content}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <>
              <button
                type="button"
                onClick={handleSaveFile}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider shadow-sm transition-all duration-200 active:-translate-y-[1px] ${
                  saved
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                }`}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('incomingModal.savedToDevice')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{t('incomingModal.saveFile')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="py-2.5 px-4 rounded-lg text-xs font-mono font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {saved ? t('common.close') : t('common.dismiss')}
              </button>
            </>
          ) : isFileOffer ? (
            !isTransferring ? (
              <>
                <button
                  type="button"
                  onClick={onAcceptFile}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-all duration-200 active:-translate-y-[1px]"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('incomingModal.acceptDownload')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  className="py-2.5 px-4 rounded-lg text-xs font-mono font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('incomingModal.decline')}
                </button>
              </>
            ) : (
              <div className="w-full text-center py-2 text-xs font-semibold text-emerald-500 font-mono">
                {t('incomingModal.downloadingMemory')}
              </div>
            )
          ) : (
            <>
              {isLink && (
                <button
                  type="button"
                  onClick={handleOpen}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-all duration-200 active:-translate-y-[1px]"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{t('incomingModal.acceptOpen')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider border shadow-sm transition-all duration-200 active:-translate-y-[1px] ${
                  copied
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>{t('common.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t('incomingModal.copyContent')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDecline}
                className="py-2.5 px-4 rounded-lg text-xs font-mono font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('incomingModal.decline')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomingModal;

