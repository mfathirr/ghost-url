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
  Sparkles,
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
    lowerType.includes('tar') ||
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
    <div className="space-y-3">
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
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer select-none group ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xl shadow-indigo-500/10 scale-[1.01]'
              : 'border-slate-300/80 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500/70 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:bg-slate-950/60'
          }`}
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 group-hover:rotate-1 transition-all shadow-md shadow-indigo-500/10">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center justify-center gap-1.5">
            <span>Drop any file to Ghost-beam it</span>
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Drag and drop your file here, or{' '}
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-2">
              browse device
            </span>
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span>Direct device-to-device • Never stored on any server</span>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 backdrop-blur-sm relative overflow-hidden animate-fade-in shadow-lg shadow-indigo-500/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                {getFileTypeIcon(selectedFile.type, selectedFile.name)}
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {selectedFile.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatBytes(selectedFile.size)}
                  </span>
                  <span>•</span>
                  <span className="truncate">{selectedFile.type || 'Binary file'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Large file warning */}
          {isLargeFile && (
            <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-900/60 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Large file ({formatBytes(selectedFile.size)}). Transfer speed depends on your local Wi-Fi or peer connection.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GhostDropZone;
