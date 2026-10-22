/**
 * Synthesizes safety chime and emergency siren using Web Audio API
 */
class SafetyAudioSystem {
  private audioCtx: AudioContext | null = null;
  public soundEnabled: boolean = true;

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

  public playEmergencySiren() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.type = 'triangle';
      
      // Siren wobble
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.25;
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(950, t + 0.12);
        osc.frequency.linearRampToValueAtTime(600, t + 0.24);
      }

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

      osc.start(now);
      osc.stop(now + 1.1);
    } catch {
      // Ignore audio permission block
    }
  }
}

export const safetyAudio = new SafetyAudioSystem();
