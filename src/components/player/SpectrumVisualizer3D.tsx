import React, { useEffect, useRef } from "react";
import { audioAnalysis } from "@/lib/audioAnalysis";

interface SpectrumVisualizer3DProps {
  analyser?: AnalyserNode | null;
  isPlaying: boolean;
  /** Hauteur en pixels du visualiseur */
  height?: number;
  className?: string;
}

const MIN_BARS = 36;
const MAX_BARS = 84;
const F_MIN = 35;
const F_MAX = 16000;

export const SpectrumVisualizer3D: React.FC<SpectrumVisualizer3DProps> = ({
  analyser: propAnalyser,
  isPlaying,
  height = 90,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Garder les refs à jour pour la boucle d'animation
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
    let levels = new Float32Array(0);
    let peaks = new Float32Array(0);
    let peakVel = new Float32Array(0);
    let freqData = new Uint8Array(128);

    const setupDimensions = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(100, Math.floor(rect.width));
      canvasHeight = height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(canvasHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Calcul du nombre de barres adapté à la largeur
      numBars = Math.max(
        MIN_BARS,
        Math.min(MAX_BARS, Math.floor(width / 8))
      );

      loBins = new Uint16Array(numBars);
      hiBins = new Uint16Array(numBars);
      levels = new Float32Array(numBars);
      peaks = new Float32Array(numBars);
      peakVel = new Float32Array(numBars);

      const activeAnalyser =
        propAnalyserRef.current || audioAnalysis.getAnalyser();
      const bins = activeAnalyser ? activeAnalyser.frequencyBinCount : 128;
      freqData = new Uint8Array(bins);
      const sampleRate = activeAnalyser
        ? activeAnalyser.context.sampleRate
        : 44100;
      const binHz = sampleRate / 2 / bins;

      // Distribution logarithmique des fréquences pour que les basses et médiums soient bien représentés
      const ratio = F_MAX / F_MIN;
      for (let i = 0; i < numBars; i++) {
        const f0 = F_MIN * Math.pow(ratio, i / numBars);
        const f1 = F_MIN * Math.pow(ratio, (i + 1) / numBars);
        loBins[i] = Math.max(0, Math.min(bins - 1, Math.floor(f0 / binHz)));
        hiBins[i] = Math.max(loBins[i], Math.min(bins - 1, Math.ceil(f1 / binHz)));
      }
    };

    setupDimensions();

    const ro = new ResizeObserver(() => {
      setupDimensions();
    });
    ro.observe(container);

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const active = isPlayingRef.current;
      const analyser = propAnalyserRef.current || audioAnalysis.getAnalyser();

      ctx.clearRect(0, 0, width, canvasHeight);

      if (analyser && active) {
        analyser.getByteFrequencyData(freqData);
      }

      const totalBars = numBars;
      const slotWidth = width / totalBars;
      const barWidth = Math.max(2, slotWidth * 0.65);
      const barPadding = (slotWidth - barWidth) / 2;

      // Attaque rapide pour le punch, relâchement fluide
      const atk = 1 - Math.exp(-dt / 0.025);
      const rel = 1 - Math.exp(-dt / 0.16);

      let maxLevel = 0;

      for (let i = 0; i < totalBars; i++) {
        let target = 0;

        if (active && analyser) {
          const l = loBins[i];
          const h = hiBins[i];
          let sum = 0;
          let maxVal = 0;
          for (let b = l; b <= h; b++) {
            const v = freqData[b];
            sum += v;
            if (v > maxVal) maxVal = v;
          }
          const count = h - l + 1;
          const avg = count > 0 ? sum / count : 0;
          // Pondération qui combine moyenne et pic pour réactivité maximale
          const combined = (avg * 0.4 + maxVal * 0.6) / 255;

          // Égalisation de compensation de courbe auditive (amplification légère des aigus)
          const tilt = 1.0 + (i / totalBars) * 0.8;
          target = Math.min(1.0, Math.pow(combined * tilt, 1.25));
        } else {
          // Sur pause : la cible retombe strictement à 0
          target = 0;
        }

        // Interpolation
        if (target > levels[i]) {
          levels[i] += (target - levels[i]) * atk;
        } else {
          levels[i] += (target - levels[i]) * rel;
        }

        // Décroissance forcée sur pause pour figer à plat rapidement
        if (!active) {
          levels[i] *= 0.88;
          if (levels[i] < 0.001) levels[i] = 0;
        }

        const lvl = levels[i];
        if (lvl > maxLevel) maxLevel = lvl;

        // Gestion du pic (petit chapeau lumineux au sommet)
        if (lvl >= peaks[i]) {
          peaks[i] = lvl;
          peakVel[i] = 0;
        } else {
          peakVel[i] += 2.2 * dt;
          peaks[i] = Math.max(lvl, peaks[i] - peakVel[i] * dt);
        }
        if (!active && peaks[i] < 0.005) peaks[i] = 0;

        const x = i * slotWidth + barPadding;
        const barHeight = Math.max(0, lvl * (canvasHeight - 6));
        const y = canvasHeight - barHeight;

        // Dessin de la barre verticale principale (collée tout en bas)
        if (barHeight > 0.5) {
          const grad = ctx.createLinearGradient(0, canvasHeight, 0, y);
          // Ambre chaud au bas vers or éclatant au sommet
          grad.addColorStop(0, "rgba(255, 140, 25, 0.45)");
          grad.addColorStop(0.5, "rgba(255, 157, 51, 0.85)");
          grad.addColorStop(1, "rgba(255, 214, 150, 0.98)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          // Haut de la barre légèrement arrondi
          const r = Math.min(2, barWidth / 2);
          ctx.roundRect(x, y, barWidth, barHeight, [r, r, 0, 0]);
          ctx.fill();
        }

        // Dessin du pic lumineux (chapeau flottant)
        if (peaks[i] > 0.02) {
          const peakY = Math.max(1, canvasHeight - peaks[i] * (canvasHeight - 6));
          ctx.fillStyle = "rgba(255, 235, 195, 0.95)";
          ctx.shadowColor = "rgba(255, 157, 51, 0.8)";
          ctx.shadowBlur = 4;
          ctx.fillRect(x, peakY - 2, barWidth, 1.8);
          ctx.shadowBlur = 0;
        }
      }

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
      {/* Canvas collé à même le bas avec zero espacement */}
      <canvas
        ref={canvasRef}
        className="absolute bottom-0 left-0 w-full h-full block"
        style={{ display: "block" }}
      />
    </div>
  );
};
