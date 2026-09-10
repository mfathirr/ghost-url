/**
 * GhostURL Procedural Sound & Haptic Engine
 *
 * Generates lightweight, zero-bandwidth sci-fi acoustic effects directly
 * in browser memory via the native Web Audio API (AudioContext) paired
 * with tactile vibration patterns via the Web Vibration API (navigator.vibrate).
 *
 * Characteristics:
 * - 0 KB network payload (no external MP3/WAV audio assets)
 * - Zero latency execution with dynamic frequency synthesis
 * - Graceful degradation for browsers lacking Vibration API (e.g. iOS Safari)
 * - Emergency atomic silence support for duress/stealth operations
 */

function triggerVibrate(pattern: number | number[]): void {
  if (
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      // Respect prefers-reduced-motion: if user wants reduced motion, skip vibration
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore browser permission or platform constraints
    }
  }
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = false;
  private isMuted: boolean = false; // Emergency duress silence switch

  public get enabled(): boolean {
    return this._enabled && !this.isMuted;
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    if (val) {
      this.isMuted = false;
      this.resume();
    }
  }

  /**
   * Initializes the AudioContext if not already created.
   * AudioContext is lazily instantiated to comply with modern browser autoplay policies.
   */
  public init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch {
        this.ctx = null;
      }
    }
    return this.ctx;
  }

  /**
   * Resumes the AudioContext if it is currently in suspended state.
   */
  public resume(): void {
    const ctx = this.init();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Emergency silence: immediately cuts off all audio and freezes the context.
   * Triggered when a duress passcode is activated.
   */
  public silence(): void {
    this.isMuted = true;
    if (this.ctx) {
      try {
        this.ctx.suspend().catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  /**
   * Disarms the emergency silence lock.
   */
  public resetMute(): void {
    this.isMuted = false;
  }

  /**
   * Ethereal Sonar Ping:
   * Triggered when a new peer is discovered on the local radar network.
   * Submerged dual-frequency sine sweep (587.33Hz D5 -> 880Hz A5) with gentle lowpass resonance.
   */
  public playSonarPing(): void {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    this.resume();

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Lowpass filter for a submerged, tactical sonar feel
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.09); // A5

      // Soft attack & exponential decay
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);

      triggerVibrate(12);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Data-Burst Chirp:
   * Triggered when a P2P link, note, or file transfer completes.
   * Rapid ascending 3-tone packet chirp (520Hz -> 1040Hz -> 1560Hz) with transient click.
   */
  public playDataBurst(): void {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    this.resume();

    try {
      const now = ctx.currentTime;

      // 1. Packet tone sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.035);
      osc.frequency.exponentialRampToValueAtTime(1560, now + 0.07);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);

      // 2. High-precision dampener click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(2400, now + 0.07);

      clickGain.gain.setValueAtTime(0.04, now + 0.07);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);

      clickOsc.start(now + 0.07);
      clickOsc.stop(now + 0.09);

      // Double-pulse confirmation vibration
      triggerVibrate([15, 30, 25]);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Incinerator & Glitch Shred:
   * Triggered when a single-view note is opened, burned, or destroyed.
   * Heavy 60Hz sub-bass thump + bandpass filtered procedural white noise glitch shred.
   */
  public playIncinerator(): void {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    this.resume();

    try {
      const now = ctx.currentTime;

      // 1. Sub-bass relay disconnect drop (60Hz -> 30Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(70, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.18);

      subGain.gain.setValueAtTime(0.12, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      subOsc.start(now);
      subOsc.stop(now + 0.2);

      // 2. Procedural white-noise glitch buffer
      const bufferSize = Math.floor(ctx.sampleRate * 0.18);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Granular noise with exponential decay envelope
        const envelope = Math.exp(-i / (bufferSize * 0.35));
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 0.18);
      filter.Q.setValueAtTime(2.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.14, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);

      // Visceral disintegrator vibration pattern
      triggerVibrate([30, 20, 50, 25, 80]);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Tactical Micro-Tick:
   * Emitted on SlideToReveal detents and slider friction markers.
   * 1800Hz damped impulse (5ms) resembling an optical encoder notch.
   */
  public playMicroTick(): void {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    this.resume();

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.008);

      triggerVibrate(8);
    } catch {
      // Ignore
    }
  }

  /**
   * Copy Success Confirmation:
   * Ascending dual-pip chirp (880Hz -> 1320Hz).
   */
  public playCopySuccess(): void {
    if (!this.enabled) return;
    const ctx = this.init();
    if (!ctx) return;
    this.resume();

    try {
      const now = ctx.currentTime;

      // Pip 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.04, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.03);

      // Pip 2 (slightly delayed)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.04);
      gain2.gain.setValueAtTime(0.05, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.075);

      triggerVibrate(10);
    } catch {
      // Ignore
    }
  }

  /**
   * Toggle Activation Blip:
   * Audibly confirms when sound mode is switched on or off.
   */
  public playToggle(turningOn: boolean): void {
    if (turningOn) {
      this.isMuted = false;
    }
    const ctx = this.init();
    if (!ctx) return;
    this.resume();

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (turningOn) {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      } else {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);
      }

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);

      triggerVibrate(10);
    } catch {
      // Ignore
    }
  }
}

// Global singleton instance
export const soundFx = new SoundEngine();
