import React, { useEffect, useRef } from "react";
import { audioAnalysis } from "@/lib/audioAnalysis";

interface SpectrumVisualizer3DProps {
  analyser?: AnalyserNode | null;
  isPlaying: boolean;
  /** Hauteur en pixels du visualiseur */
  height?: number;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Réglages                                                                   */
/* -------------------------------------------------------------------------- */

// Barres
const MIN_BARS = 36;
const MAX_BARS = 84;
const BAR_PX = 8; // largeur "cible" d'un slot, détermine le nombre de barres
const BAR_FILL = 0.65; // part du slot occupée par la barre
const TOP_MARGIN = 6; // marge haute pour le chapeau de pic

// Plage de fréquences affichée (échelle log)
const F_MIN = 50; // sous 50 Hz, quasi aucune résolution utile
const F_MAX = 16000;

// Analyser : fftSize 2048 = ~21 Hz par bin, indispensable pour séparer les graves
const FFT_SIZE = 2048;
const SMOOTHING = 0.3; // lissage léger côté analyser, le reste est géré ici
const MIN_DB = -90;
const MAX_DB = -5; // un -25 écrase les basses modernes à 255

// Mise en forme du signal
const AVG_WEIGHT = 0.6; // poids de la moyenne vs pic dans un paquet de bins
const TILT = 0.5; // compensation de la pente naturelle du spectre (aigus)
const FLOOR = 0.28; // sous ce ratio, la barre reste à zéro
const GAMMA = 1.6; // plus haut = plus de contraste entre barres
const REF_MIN = 0.35; // référence de normalisation minimale
const REF_DECAY_S = 3; // la référence redescend en ~3 s

// Dynamique temporelle (constantes de temps en secondes)
const ATTACK_S = 0.02;
const RELEASE_S = 0.09;
const PEAK_GRAVITY = 2.2;

/* -------------------------------------------------------------------------- */
/*  Analyser                                                                   */
/* -------------------------------------------------------------------------- */

const configuredAnalysers = new WeakSet<AnalyserNode>();

/** Applique la config une seule fois par analyser, quel que soit son créateur. */
const configureAnalyser = (a: AnalyserNode) => {
  if (configuredAnalysers.has(a)) return;
  a.fftSize = FFT_SIZE;
  a.smoothingTimeConstant = SMOOTHING;
  a.minDecibels = MIN_DB;
  a.maxDecibels = MAX_DB;
  configuredAnalysers.add(a);
};

/* -------------------------------------------------------------------------- */
/*  Composant                                                                  */
/* -------------------------------------------------------------------------- */

export const SpectrumVisualizer3D: React.FC<SpectrumVisualizer3DProps> = ({
  analyser: propAnalyser,
  isPlaying,
  height = 90,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Refs à jour pour la boucle d'animation (évite de relancer l'effet)
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const propAnalyserRef = useRef(propAnalyser);
  propAnalyserRef.current = propAnalyser;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let canvasHeight = height;
    let numBars = 48;
    let loBins = new Uint16Array(0);
    let hiBins = new Uint16Array(0);
    let raw = new Float32Array(0);
    let levels = new Float32Array(0);
    let peaks = new Float32Array(0);
    let peakVel = new Float32Array(0);
    let freqData = new Uint8Array(128);
    let boundAnalyser: AnalyserNode | null = null;
    let barGradient: CanvasGradient | null = null;
    let ref = 0.5; // référence adaptative de normalisation

    /** Recalcule le mapping barres -> bins pour l'analyser courant. */
    const buildBins = (a: AnalyserNode | null) => {
      if (a) configureAnalyser(a);
      const bins = a ? a.frequencyBinCount : 128;
      const sampleRate = a ? a.context.sampleRate : 44100;
      const binHz = sampleRate / 2 / bins;

      freqData = new Uint8Array(bins);
      boundAnalyser = a;

      // Répartition logarithmique : basses et médiums bien représentés
      const ratio = F_MAX / F_MIN;
      for (let i = 0; i < numBars; i++) {
        const f0 = F_MIN * Math.pow(ratio, i / numBars);
        const f1 = F_MIN * Math.pow(ratio, (i + 1) / numBars);
        loBins[i] = Math.max(0, Math.min(bins - 1, Math.floor(f0 / binHz)));
        hiBins[i] = Math.max(
          loBins[i],
          Math.min(bins - 1, Math.ceil(f1 / binHz)),
        );
      }
    };

    const setupDimensions = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(100, Math.floor(rect.width));
      canvasHeight = height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(canvasHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      numBars = Math.max(
        MIN_BARS,
        Math.min(MAX_BARS, Math.floor(width / BAR_PX)),
      );

      loBins = new Uint16Array(numBars);
      hiBins = new Uint16Array(numBars);
      raw = new Float32Array(numBars);
      levels = new Float32Array(numBars);
      peaks = new Float32Array(numBars);
      peakVel = new Float32Array(numBars);

      // Dégradé unique sur toute la hauteur : la couleur dépend de la
      // hauteur atteinte, pas de la hauteur propre de chaque barre.
      barGradient = ctx.createLinearGradient(0, canvasHeight, 0, TOP_MARGIN);
      barGradient.addColorStop(0, "rgba(255, 140, 25, 0.45)");
      barGradient.addColorStop(0.55, "rgba(255, 157, 51, 0.85)");
      barGradient.addColorStop(1, "rgba(255, 214, 150, 0.98)");

      buildBins(propAnalyserRef.current || audioAnalysis.getAnalyser());
    };

    setupDimensions();

    const ro = new ResizeObserver(() => setupDimensions());
    ro.observe(container);

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const active = isPlayingRef.current;
      const analyser = propAnalyserRef.current || audioAnalysis.getAnalyser();

      // L'analyser peut apparaître ou changer (changement de piste)
      if (analyser && analyser !== boundAnalyser) buildBins(analyser);

      ctx.clearRect(0, 0, width, canvasHeight);

      const slotWidth = width / numBars;
      const barWidth = Math.max(2, slotWidth * BAR_FILL);
      const barPadding = (slotWidth - barWidth) / 2;
      const usableHeight = canvasHeight - TOP_MARGIN;

      const atk = 1 - Math.exp(-dt / ATTACK_S);
      const rel = 1 - Math.exp(-dt / RELEASE_S);

      /* Passe 1 : valeurs brutes par barre + max de la frame ---------------- */
      let frameMax = 0;
      const hasSignal = active && !!analyser;

      if (hasSignal && analyser) {
        analyser.getByteFrequencyData(freqData);

        for (let i = 0; i < numBars; i++) {
          const l = loBins[i];
          const h = hiBins[i];
          let sum = 0;
          let maxVal = 0;
          for (let b = l; b <= h; b++) {
            const x = freqData[b];
            sum += x;
            if (x > maxVal) maxVal = x;
          }
          const avg = sum / (h - l + 1);
          const combined = (avg * AVG_WEIGHT + maxVal * (1 - AVG_WEIGHT)) / 255;
          const v = combined * (1 + (i / numBars) * TILT);
          raw[i] = v;
          if (v > frameMax) frameMax = v;
        }

        // Référence : monte instantanément, redescend lentement.
        // Garantit raw / ref <= 1, donc plus aucun clipping.
        ref = Math.max(frameMax, ref * Math.exp(-dt / REF_DECAY_S), REF_MIN);
      } else {
        raw.fill(0);
      }

      /* Passe 2 : cibles, interpolation, pics ------------------------------- */
      for (let i = 0; i < numBars; i++) {
        let target = 0;
        if (hasSignal) {
          const x = Math.max(0, (raw[i] / ref - FLOOR) / (1 - FLOOR));
          target = Math.pow(x, GAMMA);
        }

        levels[i] += (target - levels[i]) * (target > levels[i] ? atk : rel);

        // Sur pause : retombée rapide à plat
        if (!active) {
          levels[i] *= 0.88;
          if (levels[i] < 0.001) levels[i] = 0;
        }

        const lvl = levels[i];

        // Pic : monte avec la barre, retombe avec une gravité croissante
        if (lvl >= peaks[i]) {
          peaks[i] = lvl;
          peakVel[i] = 0;
        } else {
          peakVel[i] += PEAK_GRAVITY * dt;
          peaks[i] = Math.max(lvl, peaks[i] - peakVel[i] * dt);
        }
        if (!active && peaks[i] < 0.005) peaks[i] = 0;
      }

      /* Dessin des barres --------------------------------------------------- */
      if (barGradient) ctx.fillStyle = barGradient;
      const r = Math.min(2, barWidth / 2);

      for (let i = 0; i < numBars; i++) {
        const barHeight = levels[i] * usableHeight;
        if (barHeight <= 0.5) continue;

        const x = i * slotWidth + barPadding;
        const y = canvasHeight - barHeight;

        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [r, r, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      /* Dessin des pics : une seule config de shadow pour toute la frame ---- */
      ctx.fillStyle = "rgba(255, 235, 195, 0.95)";
      ctx.shadowColor = "rgba(255, 157, 51, 0.8)";
      ctx.shadowBlur = 4;
      for (let i = 0; i < numBars; i++) {
        if (peaks[i] <= 0.02) continue;
        const x = i * slotWidth + barPadding;
        const peakY = Math.max(1, canvasHeight - peaks[i] * usableHeight);
        ctx.fillRect(x, peakY - 2, barWidth, 1.8);
      }
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none pointer-events-none ${className}`}
      style={{ height }}
    >
      {/* Canvas collé à même le bas, sans espacement */}
      <canvas
        ref={canvasRef}
        className="absolute bottom-0 left-0 w-full h-full block"
      />
    </div>
  );
};