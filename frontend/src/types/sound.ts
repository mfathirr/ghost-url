export type SoundEffect =
  | 'sonar-ping'
  | 'data-burst'
  | 'incinerator'
  | 'micro-tick'
  | 'copy-success'
  | 'toggle';

export interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  playSonarPing: () => void;
  playDataBurst: () => void;
  playIncinerator: () => void;
  playMicroTick: () => void;
  playCopySuccess: () => void;
  silence: () => void;
}
