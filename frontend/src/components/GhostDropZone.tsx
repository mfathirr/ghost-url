import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  File,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  X,
  AlertTriangle,
} from 'lucide-react';

export function formatBytes(bytes: number, decimals?: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const dm = decimals !== undefined ? decimals : (i >= 3 ? 2 : (i >= 1 ? 1 : 0));
  const num = (bytes / Math.pow(k, i)).toFixed(dm);
  return `${num} ${sizes[i]}`;
}

function getFileTypeIcon(type: string, name: string) {
  const lowerType = type.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) {
    return <ImageIcon className="w-7 h-7 text-emerald-500" />;
  }
  if (lowerType.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(lowerName)) {
    return <Video className="w-7 h-7 text-rose-500" />;
  }
  if (lowerType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(lowerName)) {
    return <Music className="w-7 h-7 text-amber-500" />;
  }
  if (
    lowerType.includes('zip') ||
    lowerType.includes('tar') ||
    lowerType.includes('compressed') ||
    /\.(zip|tar|gz|7z|rar)$/i.test(lowerName)
  ) {
    return <FileArchive className="w-7 h-7 text-emerald-500" />;
  }
  if (lowerType.includes('text') || lowerType.includes('pdf') || /\.(pdf|txt|md|doc|docx)$/i.test(lowerName)) {
    return <FileText className="w-7 h-7 text-emerald-500" />;
  }
  return <File className="w-7 h-7 text-slate-400" />;
}

import { useTranslation } from '../hooks/useTranslation';

interface GhostDropZoneProps {
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
}

export const GhostDropZone: React.FC<GhostDropZoneProps> = ({
  selectedFile,
  onFileSelected,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isLargeFile = selectedFile && selectedFile.size > 500 * 1024 * 1024; // > 500 MB

  return (
    <div className="space-y-3 font-sans">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
      />

      {!selectedFile ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center transition-all cursor-pointer select-none group ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg scale-[1.01]'
              : 'border-slate-300 dark:border-zinc-800 hover:border-emerald-500/60 bg-slate-50/50 dark:bg-black/40'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-3 group-hover:scale-105 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1 font-mono">
            {t('dropZone.selectOrDrop')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {t('dropZone.dragPrompt')}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-2">
              {t('dropZone.browseLocalDisk')}
            </span>
          </p>

          <div className="mt-3.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span>{t('dropZone.directStream')}</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 relative overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shrink-0 shadow-sm">
                {getFileTypeIcon(selectedFile.type, selectedFile.name)}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {selectedFile.name}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatBytes(selectedFile.size)}
                  </span>
                  <span>•</span>
                  <span className="truncate">{selectedFile.type || t('dropZone.binaryFile')}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-zinc-800 transition-colors shrink-0"
              title={t('dropZone.removeFile')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Large file warning */}
          {isLargeFile && (
            <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                {t('dropZone.highCapacity', { size: formatBytes(selectedFile.size) })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GhostDropZone;
