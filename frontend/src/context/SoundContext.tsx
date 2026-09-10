import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SoundContextType } from '../types/sound';
import { soundFx } from '../utils/soundEngine';

export type { SoundContextType };

const STORAGE_KEY = 'ghost_sound_fx';

const SoundContext = createContext<SoundContextType | null>(null);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'enabled';
    } catch {
      return false;
    }
  });

  // Keep singleton synchronized with React state
  useEffect(() => {
    soundFx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Unlock AudioContext on first user interaction to satisfy browser autoplay policy
  useEffect(() => {
    const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
    const handleFirstGesture = () => {
      soundFx.resume();
      events.forEach((evt) => window.removeEventListener(evt, handleFirstGesture));
    };

    events.forEach((evt) => window.addEventListener(evt, handleFirstGesture, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleFirstGesture));
    };
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'enabled' : 'disabled');
    } catch {
      // ignore
    }
    soundFx.enabled = enabled;
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'enabled' : 'disabled');
      } catch {
        // ignore
      }
      soundFx.enabled = next;
      // Play brief audible confirmation blip
      soundFx.playToggle(next);
      return next;
    });
  }, []);

  const playSonarPing = useCallback(() => soundFx.playSonarPing(), []);
  const playDataBurst = useCallback(() => soundFx.playDataBurst(), []);
  const playIncinerator = useCallback(() => soundFx.playIncinerator(), []);
  const playMicroTick = useCallback(() => soundFx.playMicroTick(), []);
  const playCopySuccess = useCallback(() => soundFx.playCopySuccess(), []);
  const silence = useCallback(() => soundFx.silence(), []);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        setSoundEnabled,
        playSonarPing,
        playDataBurst,
        playIncinerator,
        playMicroTick,
        playCopySuccess,
        silence,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export function useSound(): SoundContextType {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
