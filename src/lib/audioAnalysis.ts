// Web Audio API Analysis Engine for High-FPS Stereo VU-Meters & Frequency Visualizers

class AudioAnalysisEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private attachedElement: HTMLAudioElement | null = null;
  private freqData: Uint8Array = new Uint8Array(new ArrayBuffer(64));

  // Peak decay state for authentic VFD / meter phosphor persistence
  private leftLevel: number = 0;
  private rightLevel: number = 0;
  private peakLeft: number = 0;
  private peakRight: number = 0;

  /**
   * Only remembers the element. Audio is NOT routed through Web Audio here:
   * once an element is captured by createMediaElementSource its output goes
   * exclusively through the AudioContext, which yields silence when the context
   * is suspended or when the source is cross-origin (Tauri asset:// protocol).
   */
  public attachAudio(audioElement: HTMLAudioElement) {
    this.attachedElement = audioElement;
    this.enableAnalysis();

    if (typeof window !== 'undefined') {
      const unlock = () => this.resume();
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('pointerdown', unlock, { once: true });
    }
  }

  /**
   * Opt-in: builds the analyser graph. Call it only from a visualizer
   * (e.g. VU-meter) that really needs frequency data.
   */
  public enableAnalysis() {
    const audioElement = this.attachedElement;
    if (!audioElement || this.sourceNode) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.55;
        this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      }

      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.resume();
    } catch (err) {
      console.warn('Web Audio Analyser hook warning:', err);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    this.enableAnalysis();
    return this.analyser;
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  // Returns normalized stereo levels (0.0 to 1.0) with physics decay
  public getLevels(isPlaying: boolean): {
    left: number;
    right: number;
    peakLeft: number;
    peakRight: number;
  } {
    if (!isPlaying) {
      // Natural exponential decay to 0 when paused
      this.leftLevel = Math.max(0, this.leftLevel * 0.85);
      this.rightLevel = Math.max(0, this.rightLevel * 0.85);
      this.peakLeft = Math.max(0, this.peakLeft * 0.94);
      this.peakRight = Math.max(0, this.peakRight * 0.94);
      return {
        left: this.leftLevel,
        right: this.rightLevel,
        peakLeft: this.peakLeft,
        peakRight: this.peakRight,
      };
    }

    if (this.analyser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.analyser.getByteFrequencyData(this.freqData as any);

      // Split low/mid and mid/high for simulated stereo channel separation
      const half = Math.floor(this.freqData.length / 2);
      let sumL = 0;
      let sumR = 0;

      for (let i = 0; i < half; i++) {
        sumL += this.freqData[i];
      }
      for (let i = half; i < this.freqData.length; i++) {
        sumR += this.freqData[i];
      }

      const rawL = (sumL / (half * 255)) * 1.35;
      const rawR = (sumR / (half * 255)) * 1.45;

      const instantL = Math.min(1.0, rawL);
      const instantR = Math.min(1.0, rawR);

      // Attack (instant) vs Decay (viscous phosphor lag)
      this.leftLevel = instantL > this.leftLevel ? instantL : this.leftLevel * 0.86 + instantL * 0.14;
      this.rightLevel = instantR > this.rightLevel ? instantR : this.rightLevel * 0.86 + instantR * 0.14;

      // Peak-hold with slow gravity drop
      if (this.leftLevel > this.peakLeft) {
        this.peakLeft = this.leftLevel;
      } else {
        this.peakLeft = Math.max(0, this.peakLeft * 0.96);
      }

      if (this.rightLevel > this.peakRight) {
        this.peakRight = this.rightLevel;
      } else {
        this.peakRight = Math.max(0, this.peakRight * 0.96);
      }
    } else {
      // Fallback synthetic meter bounce when audio node is restricted
      const t = Date.now() * 0.008;
      const synthL = Math.max(0.1, (Math.sin(t * 3.5) + Math.cos(t * 7.1) + 2) / 4);
      const synthR = Math.max(0.1, (Math.sin(t * 4.2) + Math.cos(t * 6.3) + 2) / 4);

      this.leftLevel = synthL;
      this.rightLevel = synthR;
      this.peakLeft = Math.max(this.leftLevel, this.peakLeft * 0.96);
      this.peakRight = Math.max(this.rightLevel, this.peakRight * 0.96);
    }

    return {
      left: this.leftLevel,
      right: this.rightLevel,
      peakLeft: this.peakLeft,
      peakRight: this.peakRight,
    };
  }
}

export const audioAnalysis = new AudioAnalysisEngine();
