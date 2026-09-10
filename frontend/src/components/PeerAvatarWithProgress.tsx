import React from 'react';
import { Smartphone, Tablet, Monitor, Laptop, Check, Send } from 'lucide-react';
import type { PeerInfo } from '../types/p2p';

export function getDeviceIcon(os: string, deviceType: string) {
  const lowerOS = (os || '').toLowerCase();
  const lowerDev = (deviceType || '').toLowerCase();

  if (lowerDev === 'mobile') {
    return <Smartphone className="w-4 h-4 text-emerald-500" />;
  }
  if (lowerDev === 'tablet') {
    return <Tablet className="w-4 h-4 text-emerald-500" />;
  }
  if (lowerOS.includes('windows') || lowerOS.includes('linux')) {
    return <Monitor className="w-4 h-4 text-emerald-500" />;
  }
  return <Laptop className="w-4 h-4 text-emerald-500" />;
}

export interface PeerAvatarWithProgressProps {
  peer: PeerInfo;
  progress: number | null; // 0-100 or null
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
      className={`relative flex items-center justify-between p-3 rounded-xl border transition-all text-left w-full group ${
        isSent
          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : isTransferring
          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm'
          : 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 hover:border-emerald-500/50 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar container with optional SVG progress ring */}
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
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
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-emerald-500 transition-all duration-300 ease-out"
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
            className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-all ${
              isSent
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : isTransferring
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold'
                : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 group-hover:scale-105'
            }`}
          >
            {isSent ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : isTransferring ? (
              <span>{progress}%</span>
            ) : (
              getDeviceIcon(peer.os, peer.deviceType)
            )}
          </div>
        </div>

        {/* Peer Info */}
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold truncate group-hover:text-emerald-500 transition-colors">
            {peer.name}
          </div>
          <div className="text-[10px] font-mono text-slate-400 capitalize truncate">
            {peer.os} • {peer.deviceType}
          </div>
        </div>
      </div>

      {/* Action state indicator */}
      <div className="ml-3 shrink-0">
        {isSent ? (
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
            <Check className="w-3 h-3" />
            <span>Beamed</span>
          </span>
        ) : isTransferring ? (
          <span className="text-xs font-bold text-emerald-500 font-mono">
            {progress}%
          </span>
        ) : isSending ? (
          <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
            <span>{actionLabel}</span>
            <Send className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>
    </button>
  );
};

export default PeerAvatarWithProgress;
