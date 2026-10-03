// Web Audio API Zero-Latency Mechanical Sound Synthesizer
// Generates authentic mechanical clicks, solenoid thuds, and knob ratchet ticks
// entirely in real-time without requiring external audio asset files.

class HapticSoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    const saved = localStorage.getItem('musik_haptics_enabled');
    if (saved !== null) {
      this.isEnabled = saved === 'true';
    }
  }

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    localStorage.setItem('musik_haptics_enabled', String(enabled));
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  // Heavy solenoid relay clack for Play/Pause mechanical button
  public playHeavySwitch() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // 1. Low frequency mechanical thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.045);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);

    // 2. High metallic spring snap (filtered noise impulse)
    const bufferSize = Math.floor(ctx.sampleRate * 0.025);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, t);
    filter.Q.setValueAtTime(4.0, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(t);
  }

  // Crisp mechanical toggle switch snap (for tabs, view switches, filters)
  public playToggleSnap() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.022);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.025);
  }

  // Ultra-subtle mechanical detent tick (for rotary knob steps & fader ticks)
  public playRatchetTick() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.006);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.008);
  }
}

export const hapticAudio = new HapticSoundEngine();
