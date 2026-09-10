import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { useTranslation } from '../hooks/useTranslation';

export const SoundToggle: React.FC = () => {
  const { soundEnabled, toggleSound } = useSound();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={soundEnabled ? t('nav.soundAriaActive') : t('nav.soundAriaMuted')}
      title={soundEnabled ? t('nav.soundTitleActive') : t('nav.soundTitleMuted')}
      className={`relative p-2 rounded-lg border transition-all shadow-sm ${
        soundEnabled
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/30'
          : 'border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-slate-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-500/40 dark:hover:border-emerald-500/40'
      } backdrop-blur`}
    >
      {soundEnabled ? (
        <>
          <Volume2 className="w-4 h-4 transition-transform active:scale-90" aria-hidden="true" />
          <span
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
            aria-hidden="true"
          />
        </>
      ) : (
        <VolumeX className="w-4 h-4 transition-transform active:scale-90" aria-hidden="true" />
      )}
    </button>
  );
};

