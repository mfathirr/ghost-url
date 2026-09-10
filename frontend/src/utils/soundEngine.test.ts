import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundEngine } from './soundEngine';

interface MockOscillator {
  type: OscillatorType;
  frequency: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockGain {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
}

interface MockFilter {
  type: BiquadFilterType;
  frequency: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  Q: {
    setValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
}

interface MockBufferSource {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockAudioContextInstance {
  currentTime: number;
  sampleRate: number;
  state: AudioContextState;
  destination: Record<string, unknown>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBiquadFilter: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  suspend: ReturnType<typeof vi.fn>;
}

describe('SoundEngine', () => {
  let sound: SoundEngine;
  let mockAudioContext: MockAudioContextInstance;
  let mockOscillator: MockOscillator;
  let mockGain: MockGain;
  let mockFilter: MockFilter;
  let mockBufferSource: MockBufferSource;
  let mockVibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockFilter = {
      type: 'lowpass',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      Q: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockBufferSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 10,
      sampleRate: 44100,
      state: 'suspended',
      destination: {},
      createOscillator: vi.fn(function () {
        return { ...mockOscillator };
      }),
      createGain: vi.fn(function () {
        return { ...mockGain };
      }),
      createBiquadFilter: vi.fn(function () {
        return { ...mockFilter };
      }),
      createBuffer: vi.fn(function () {
        return {
          getChannelData: vi.fn(() => new Float32Array(100)),
        };
      }),
      createBufferSource: vi.fn(function () {
        return { ...mockBufferSource };
      }),
      resume: vi.fn().mockResolvedValue(undefined),
      suspend: vi.fn().mockResolvedValue(undefined),
    };

    const MockAudioContext = vi.fn(function (this: unknown) {
      return mockAudioContext;
    });

    const mockWindow = {
      AudioContext: MockAudioContext,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    };

    Object.defineProperty(globalThis, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true,
    });

    mockVibrate = vi.fn(() => true);
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });

    sound = new SoundEngine();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('is disabled by default for stealth and discretion', () => {
    expect(sound.enabled).toBe(false);
  });

  it('resumes audio context when enabled is set to true', () => {
    sound.enabled = true;
    expect(sound.enabled).toBe(true);
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it('does not produce sounds or vibrations when disabled', () => {
    sound.enabled = false;
    sound.playSonarPing();
    sound.playDataBurst();
    sound.playIncinerator();
    sound.playMicroTick();
    sound.playCopySuccess();

    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('plays sonar ping with submerged lowpass sweep when enabled', () => {
    sound.enabled = true;
    sound.playSonarPing();

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createBiquadFilter).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockVibrate).toHaveBeenCalledWith(12);
  });

  it('plays data-burst chirp with upward frequency sweep on completion', () => {
    sound.enabled = true;
    sound.playDataBurst();

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockVibrate).toHaveBeenCalledWith([15, 30, 25]);
  });

  it('plays incinerator glitch shred with destructive vibration pattern', () => {
    sound.enabled = true;
    sound.playIncinerator();

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(mockAudioContext.createBiquadFilter).toHaveBeenCalled();
    expect(mockVibrate).toHaveBeenCalledWith([30, 20, 50, 25, 80]);
  });

  it('plays tactile micro-tick on slider detents', () => {
    sound.enabled = true;
    sound.playMicroTick();

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockVibrate).toHaveBeenCalledWith(8);
  });

  it('plays copy confirmation chirp on clipboard success', () => {
    sound.enabled = true;
    sound.playCopySuccess();

    // Two pips created
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  it('plays audio feedback on toggle activation', () => {
    sound.playToggle(true);
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  it('enforces atomic silence on duress trigger', () => {
    sound.enabled = true;
    expect(sound.enabled).toBe(true);

    sound.silence();
    expect(sound.enabled).toBe(false);
    expect(mockAudioContext.suspend).toHaveBeenCalled();

    // Subsequent calls while silenced must produce zero audio/vibrations
    mockAudioContext.createOscillator.mockClear();
    mockVibrate.mockClear();

    sound.playSonarPing();
    sound.playIncinerator();

    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    expect(mockVibrate).not.toHaveBeenCalled();

    // Resetting mute restores availability
    sound.resetMute();
    expect(sound.enabled).toBe(true);
  });

  it('respects prefers-reduced-motion by suppressing vibration', () => {
    const customWindow = (globalThis as unknown as { window: { matchMedia: ReturnType<typeof vi.fn> } }).window;
    customWindow.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    sound.enabled = true;
    sound.playSonarPing();

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    // Vibration should NOT be called when reduced motion is preferred
    expect(mockVibrate).not.toHaveBeenCalled();
  });
});
