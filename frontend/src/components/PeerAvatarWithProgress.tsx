import React from 'react';
import { Smartphone, Tablet, Monitor, Laptop, Check, Send } from 'lucide-react';
import type { PeerInfo } from '../types/p2p';

export function getDeviceIcon(os: string, deviceType: string) {
  const lowerOS = (os || '').toLowerCase();
  const lowerDev = (deviceType || '').toLowerCase();

  if (lowerDev === 'mobile') {
    return <Smartphone className="w-4 h-4 text-indigo-500" />;
  }
  if (lowerDev === 'tablet') {
    return <Tablet className="w-4 h-4 text-indigo-500" />;
  }
  if (lowerOS.includes('windows') || lowerOS.includes('linux')) {
    return <Monitor className="w-4 h-4 text-indigo-500" />;
  }
  return <Laptop className="w-4 h-4 text-indigo-500" />;
}

export interface PeerAvatarWithProgressProps {
  peer: PeerInfo;
  progress: number | null; // 0–100 or null
  isSent?: boolean;
  isSending?: boolean;
  disabled?: boolean;
  actionLabel?: string;
  onClick: () => void;
}

export const PeerAvatarWithProgress: React.FC<PeerAvatarWithProgressProps> = ({
  peer,
  progress,
  isSent = false,
  isSending = false,
  disabled = false,
  actionLabel = 'Send',
  onClick,
}) => {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    progress !== null ? circumference - (progress / 100) * circumference : circumference;

  const isTransferring = progress !== null && progress >= 0 && progress <= 100;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSending || isTransferring}
      className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all text-left w-full group ${
        isSent
          ? 'border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
          : isTransferring
          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-md shadow-indigo-500/10'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-slate-800 dark:text-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Avatar container with optional SVG progress ring */}
        <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
          {/* Circular SVG progress ring */}
          {isTransferring && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
              viewBox="0 0 44 44"
            >
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-indigo-200 dark:stroke-indigo-900/60"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-300 ease-out"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          )}

          {/* Inner badge */}
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transition-all ${
              isSent
                ? 'bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300'
                : isTransferring
                ? 'bg-indigo-100 dark:bg-indigo-900/70 border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200 font-mono text-[11px] font-bold'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:scale-105'
            }`}
          >
            {isSent ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : isTransferring ? (
              <span>{progress}%</span>
            ) : (
              getDeviceIcon(peer.os, peer.deviceType)
            )}
          </div>
        </div>

        {/* Peer Info */}
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {peer.name}
          </div>
          <div className="text-[11px] text-slate-400 capitalize truncate">
            {peer.os} • {peer.deviceType}
          </div>
        </div>
      </div>

      {/* Action state indicator */}
      <div className="ml-3 shrink-0">
        {isSent ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Sent!</span>
          </span>
        ) : isTransferring ? (
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
            {progress}%
          </span>
        ) : isSending ? (
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
            <span>{actionLabel}</span>
            <Send className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>
    </button>
  );
};

export default PeerAvatarWithProgress;
