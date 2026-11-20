const SIREN_DURATION_STORAGE_KEY = 'prev_sos_siren_seconds';
const DEFAULT_SIREN_SECONDS = 5;

/**
 * Synthesizes safety chime and configurable emergency siren using Web Audio API
 */
class SafetyAudioSystem {
  private audioCtx: AudioContext | null = null;
  private activeSirenOsc: OscillatorNode | null = null;
  private activeSirenGain: GainNode | null = null;
  private sirenStopTimer: ReturnType<typeof setTimeout> | null = null;
  private sirenStateListeners = new Set<(playing: boolean) => void>();
  public soundEnabled: boolean = true;

  public subscribeSirenState(cb: (playing: boolean) => void): () => void {
    this.sirenStateListeners.add(cb);
    return () => {
      this.sirenStateListeners.delete(cb);
    };
  }

  private notifySirenState(playing: boolean) {
    this.sirenStateListeners.forEach((cb) => {
      try {
        cb(playing);
      } catch {
        // Ignore listener errors
      }
    });
  }

  public getSirenDurationSeconds(): number {
    if (typeof window === 'undefined') return DEFAULT_SIREN_SECONDS;
    try {
      const raw = localStorage.getItem(SIREN_DURATION_STORAGE_KEY);
      const parsed = raw ? Number(raw) : DEFAULT_SIREN_SECONDS;
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 60) {
        return Math.round(parsed);
      }
    } catch {
      // Ignore storage access error
    }
    return DEFAULT_SIREN_SECONDS;
  }

  public setSirenDurationSeconds(seconds: number): number {
    const clamped = Math.max(1, Math.min(60, Math.round(Number(seconds) || DEFAULT_SIREN_SECONDS)));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SIREN_DURATION_STORAGE_KEY, String(clamped));
      } catch {
        // Ignore storage quota errors
      }
    }
    return clamped;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public playIncidentAlert(severity: 'Leve' | 'Moderado' | 'Grave' | 'Crítico' = 'Moderado') {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (severity === 'Crítico' || severity === 'Grave') {
        // Double urgent high-low pulse
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        osc.frequency.setValueAtTime(880, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Clean dual-tone confirmation chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public stopEmergencySiren() {
    if (this.sirenStopTimer) {
      clearTimeout(this.sirenStopTimer);
      this.sirenStopTimer = null;
    }
    try {
      if (this.activeSirenOsc) {
        this.activeSirenOsc.onended = null;
        this.activeSirenOsc.stop();
        this.activeSirenOsc.disconnect();
      }
      if (this.activeSirenGain) {
        this.activeSirenGain.disconnect();
      }
    } catch {
      // Ignore already stopped oscillator
    }
    this.activeSirenOsc = null;
    this.activeSirenGain = null;
    this.notifySirenState(false);
  }

  public playEmergencySiren(durationSeconds?: number) {
    if (!this.soundEnabled) return;
    this.stopEmergencySiren();
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const duration = Math.max(
        1,
        Math.min(60, Math.round(durationSeconds ?? this.getSirenDurationSeconds()))
      );

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.type = 'triangle';

      // Schedule 0.5s siren wobble cycles across the full configured duration
      const cycleSeconds = 0.5;
      const cycles = Math.max(2, Math.ceil(duration / cycleSeconds));
      for (let i = 0; i < cycles; i++) {
        const t = now + i * cycleSeconds;
        if (t >= now + duration) break;
        const mid = Math.min(t + 0.25, now + duration);
        const end = Math.min(t + cycleSeconds, now + duration);
        osc.frequency.setValueAtTime(600, t);
        if (mid > t) {
          osc.frequency.linearRampToValueAtTime(960, mid);
        }
        if (end > mid) {
          osc.frequency.linearRampToValueAtTime(600, end);
        }
      }

      const fadeStart = Math.max(now, now + duration - 0.18);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.setValueAtTime(0.26, fadeStart);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      this.activeSirenOsc = osc;
      this.activeSirenGain = gain;
      this.notifySirenState(true);

      osc.onended = () => {
        if (this.activeSirenOsc === osc) {
          this.stopEmergencySiren();
        }
      };

      osc.start(now);
      osc.stop(now + duration);

      this.sirenStopTimer = setTimeout(() => {
        this.stopEmergencySiren();
      }, duration * 1000 + 150);
    } catch {
      this.notifySirenState(false);
    }
  }
}

export const safetyAudio = new SafetyAudioSystem();
