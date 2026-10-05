import React, { useEffect, useRef, useState } from "react";
import {
  ListBullets,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
  NavigationArrowIcon,
  Waveform,
} from "@phosphor-icons/react";
import { formatDuration } from "@/lib/utils";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { getPlayerAudioSource } from "@/lib/audioSource";
import { SpectrumVisualizer3D } from "./SpectrumVisualizer3D";
import type { Track } from "@/types";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques                                                     */
/*                                                                             */
/*  Injectés une seule fois (les :active / [data-latched] ne sont pas          */
/*  faisables en style inline). Tu peux déplacer ce bloc dans ton CSS global.  */
/*                                                                             */
/*  Logique de lumière : source en haut. Les surfaces en relief ont un liseré  */
/*  clair en haut et sombre en bas, les surfaces creusées l'inverse.           */
/* -------------------------------------------------------------------------- */

const SKEU_CSS = `
/* ---------- Touche (relief, s'enfonce au clic, se verrouille si allumée) ---------- */
.skeu-key {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  color: rgba(255, 157, 51, 0.7);
  border: 1px solid rgba(0, 0, 0, 0.7);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 46%, rgba(0,0,0,0.16) 54%, rgba(0,0,0,0.26) 100%),
    linear-gradient(180deg, #3d404c 0%, #272a33 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 3px rgba(0,0,0,0.45),
    inset 1px 0 0 rgba(255,255,255,0.05),
    inset -1px 0 0 rgba(0,0,0,0.25),
    0 3px 0 #0e0f15,
    0 6px 10px rgba(0,0,0,0.55);
  transition: transform 70ms ease-out, box-shadow 70ms ease-out, color 150ms;
}
.skeu-key--round { border-radius: 9999px; }
.skeu-key--rect  { border-radius: 12px; }

/* Icône gravée dans le métal */
.skeu-key svg {
  filter: drop-shadow(0 -1px 0 rgba(0,0,0,0.85)) drop-shadow(0 1px 0 rgba(255,255,255,0.10));
  transition: filter 150ms;
}
.skeu-key:hover { color: rgba(255, 178, 89, 0.95); }
.skeu-key:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 3px; }

/* Enfoncée (clic) ou verrouillée (data-latched) : la touche descend et s'éclaire */
.skeu-key:active,
.skeu-key[data-latched="true"] {
  transform: translateY(2px);
  background: linear-gradient(180deg, #1b1d24 0%, #262932 100%);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.8),
    inset 0 -1px 0 rgba(255,255,255,0.06),
    0 1px 0 #0e0f15,
    0 2px 5px rgba(0,0,0,0.5);
}
.skeu-key[data-latched="true"] { color: #ffb259; }

/* Voyant LED au sommet de la touche */
.skeu-key--led::after {
  content: "";
  position: absolute;
  top: 5px;
  left: 50%;
  width: 6px;
  height: 3px;
  margin-left: -3px;
  border-radius: 2px;
  background: #3b2a14;
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.6);
  transition: background 150ms, box-shadow 150ms;
}
.skeu-key--led[data-latched="true"]::after {
  background: #ffb259;
  box-shadow: 0 0 6px 1px rgba(255,157,51,0.9);
}

/* Variante ambre : gros bouton d'action rétro-éclairé */
.skeu-key--amber,
.skeu-key--amber:hover {
  color: #2a1500;
  background: linear-gradient(180deg, #ffc98a 0%, #ff9d33 52%, #e07a12 100%);
  border-color: rgba(60, 25, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 -2px 3px rgba(120,50,0,0.45),
    0 3px 0 #7a3a05,
    0 6px 12px rgba(0,0,0,0.6),
    0 0 14px rgba(255,157,51,0.35);
}
.skeu-key--amber svg { filter: drop-shadow(0 1px 0 rgba(255,255,255,0.35)); }
.skeu-key--amber:active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #e88f25 0%, #d9780f 100%);
  box-shadow:
    inset 0 2px 5px rgba(90,35,0,0.7),
    0 1px 0 #7a3a05,
    0 2px 5px rgba(0,0,0,0.5);
}

/* ---------- Surface creusée (puits) et afficheur sous verre ---------- */
.skeu-well {
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.75);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(255,255,255,0.03),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-display {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.75);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(255,255,255,0.03),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-display::after,
.skeu-glass {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(170deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 40%),
    repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 1px, rgba(0,0,0,0) 1px 3px);
}
.skeu-display-text {
  color: #ffb259;
  text-shadow: 0 0 6px rgba(255,157,51,0.55);
}

/* ---------- Fader de progression ---------- */
.skeu-slot {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 4px;
  background: linear-gradient(180deg, #05060a 0%, #0b0d13 100%);
  border: 1px solid rgba(0, 0, 0, 0.8);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.08);
}
.skeu-slot__fill {
  height: 100%;
  background: linear-gradient(180deg, #ffc98a 0%, #ff9d33 45%, #d9780f 100%);
  box-shadow: 0 0 10px rgba(255,157,51,0.7);
}
.skeu-cap {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 24px;
  border-radius: 4px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(0, 0, 0, 0.8);
  background:
    linear-gradient(90deg, rgba(0,0,0,0) 0 5px, #ffb259 5px 7px, rgba(0,0,0,0) 7px),
    linear-gradient(180deg, #52566a 0%, #2d303a 48%, #20222a 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.28),
    inset 0 -1px 0 rgba(0,0,0,0.5),
    0 3px 5px rgba(0,0,0,0.75);
  transition: box-shadow 120ms;
}
.skeu-seek:hover .skeu-cap,
.skeu-seek:focus-visible .skeu-cap,
.skeu-seek[data-dragging="true"] .skeu-cap {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -1px 0 rgba(0,0,0,0.5),
    0 3px 5px rgba(0,0,0,0.75),
    0 0 10px rgba(255,157,51,0.35);
}
.skeu-seek:focus-visible { outline: 2px solid rgba(255,157,51,0.6); outline-offset: 2px; border-radius: 6px; }

/* ---------- Potentiomètre rotatif ---------- */
.skeu-knob {
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  cursor: ns-resize;
  touch-action: none;
  border: 1px solid rgba(0, 0, 0, 0.85);
  background:
    radial-gradient(circle at 50% 35%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 60%),
    conic-gradient(from 0deg, #3a3d48, #5d6170 12%, #2a2d36 25%, #50545f 38%, #262931 50%, #5d6170 62%, #2a2d36 75%, #50545f 88%, #3a3d48);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.32),
    inset 0 -2px 3px rgba(0,0,0,0.5),
    0 3px 6px rgba(0,0,0,0.75),
    0 0 0 2px #10121a,
    0 0 0 3px rgba(255,255,255,0.07);
}
.skeu-knob:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 5px; }
.skeu-knob__ind {
  position: absolute;
  left: 50%;
  top: 3px;
  width: 2px;
  height: 8px;
  margin-left: -1px;
  border-radius: 1px;
  background: #ffb259;
  box-shadow: 0 0 6px rgba(255,157,51,0.95);
  transform-origin: 50% 11px;
}
.skeu-tick {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 3px;
  margin: -1.5px 0 0 -1px;
  border-radius: 1px;
  background: #3a2a14;
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.5);
  transition: background 120ms, box-shadow 120ms;
}
.skeu-tick[data-lit="true"] {
  background: #ffb259;
  box-shadow: 0 0 4px rgba(255,157,51,0.9);
}

/* ---------- Panneau métal brossé ---------- */
.skeu-panel {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #2c2f3a 0%, #1a1c24 100%);
  border: 1px solid rgba(0, 0, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.16),
    inset 0 -1px 0 rgba(0,0,0,0.6),
    0 0 0 1px rgba(255,255,255,0.04),
    0 24px 48px rgba(0,0,0,0.85);
}
/* Rainure gravée : ombre en haut, reflet en bas */
.skeu-groove {
  height: 2px;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 50%, rgba(255,255,255,0.08) 50%);
}
/* Vis de fixation : tête métal avec fente en biais */
.skeu-screw {
  display: inline-block;
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  background:
    linear-gradient(45deg, rgba(0,0,0,0) 44%, rgba(0,0,0,0.75) 44% 56%, rgba(0,0,0,0) 56%),
    radial-gradient(circle at 35% 30%, #8b8f9e 0%, #4a4d5a 55%, #2a2c35 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 1px 1px rgba(0,0,0,0.8),
    0 0 0 1px rgba(0,0,0,0.6);
}

@media (prefers-reduced-motion: reduce) {
  .skeu-key, .skeu-key svg, .skeu-tick, .skeu-cap { transition: none; }
}
`;

const SKEU_STYLE_ID = "skeu-player-styles";

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(SKEU_STYLE_ID) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), { id: SKEU_STYLE_ID });
  el.textContent = SKEU_CSS; // réécrit à chaque HMR pour que les modifs s'appliquent
  if (!el.isConnected) document.head.appendChild(el);
}

/* -------------------------------------------------------------------------- */
/*  Briques réutilisables                                                      */
/* -------------------------------------------------------------------------- */

/** Touches de transport. Play reste enfoncée et allumée tant que ça joue, comme sur une platine à cassettes. */
export const TransportControls: React.FC<{
  isPlaying: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
}> = ({ isPlaying, onPrev, onPlayPause, onNext }) => (
  <div className="flex items-center gap-3 pb-1">
    <button
      type="button"
      onClick={onPrev}
      title="Piste précédente"
      className="skeu-key skeu-key--rect w-14 h-11"
    >
      <SkipBack size={22} weight="fill" />
    </button>
    <button
      type="button"
      onClick={onPlayPause}
      title={isPlaying ? "Pause" : "Lecture"}
      data-latched={isPlaying}
      className="skeu-key skeu-key--rect w-[72px] h-[52px]"
    >
      {isPlaying ? (
        <Pause size={30} weight="fill" />
      ) : (
        <Play size={30} weight="fill" />
      )}
    </button>
    <button
      type="button"
      onClick={onNext}
      title="Piste suivante"
      className="skeu-key skeu-key--rect w-14 h-11"
    >
      <SkipForward size={22} weight="fill" />
    </button>
  </div>
);

const KNOB_TICKS = Array.from({ length: 11 }, (_, i) => i);

/**
 * Volume : touche mute + potentiomètre rotatif avec couronne de LED.
 * Glisser verticalement, molette ou flèches du clavier pour ajuster.
 */
export const VolumeControl: React.FC<{
  volume: number;
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}> = ({ volume, isMuted, onVolumeChange, onToggleMute }) => {
  const effective = isMuted ? 0 : volume;
  const drag = useRef<{ y: number; v: number } | null>(null);
  const angle = -135 + effective * 270;

  const nudge = (delta: number) =>
    onVolumeChange(clamp(effective + delta, 0, 1));

  return (
    <div
      className="flex items-center gap-2"
      onWheel={(e) => {
        e.stopPropagation();
        nudge(e.deltaY < 0 ? 0.05 : -0.05);
      }}
    >
      <button
        type="button"
        onClick={onToggleMute}
        title={isMuted ? "Réactiver le son" : "Couper le son"}
        aria-pressed={isMuted}
        data-latched={isMuted}
        className="skeu-key skeu-key--round w-7 h-7"
      >
        {effective === 0 ? (
          <SpeakerSlash size={14} weight="fill" />
        ) : (
          <SpeakerHigh size={14} weight="fill" />
        )}
      </button>

      <div className="relative w-12 h-12 flex-shrink-0">
        {KNOB_TICKS.map((i) => (
          <span
            key={i}
            className="skeu-tick"
            data-lit={effective > 0 && i / 10 <= effective + 0.001}
            style={{
              transform: `rotate(${-135 + i * 27}deg) translateY(-21px)`,
            }}
          />
        ))}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(effective * 100)}
          title="Volume (glisser verticalement, molette ou flèches)"
          className="skeu-knob absolute inset-0 m-auto"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, v: effective };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dv = (drag.current.y - e.clientY) / 150;
            onVolumeChange(clamp(drag.current.v + dv, 0, 1));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              nudge(0.05);
            } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              nudge(-0.05);
            }
          }}
        >
          <span
            className="skeu-knob__ind"
            style={{ transform: `rotate(${angle}deg)` }}
          />
        </div>
      </div>
    </div>
  );
};

/** Temps restant : afficheur encastré sous verre. */
export const RemainingTime: React.FC<{ seconds: number }> = ({ seconds }) => (
  <span
    title="Temps restant"
    className="skeu-display inline-flex items-center rounded-md px-2.5 py-1"
  >
    <span className="skeu-display-text font-mono text-xs font-bold tabular-nums">
      -{formatDuration(seconds)}
    </span>
  </span>
);

/**
 * Fader de progression : rainure creusée, remplissage lumineux, curseur métal.
 * Le glissement est prévisualisé localement et le seek n'est envoyé qu'au relâchement.
 */
export const SeekLine: React.FC<{
  progress: number;
  onSeek: (ratio: number) => void;
}> = ({ progress, onSeek }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const shown = dragRatio ?? progress;

  const ratioFrom = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Position dans le morceau"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      title="Cliquer ou glisser pour naviguer dans le morceau"
      data-dragging={dragRatio !== null}
      className="skeu-seek relative flex items-center h-6 px-2 cursor-pointer touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragRatio(ratioFrom(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragRatio === null) return;
        setDragRatio(ratioFrom(e.clientX));
      }}
      onPointerUp={(e) => {
        if (dragRatio === null) return;
        onSeek(ratioFrom(e.clientX));
        setDragRatio(null);
      }}
      onPointerCancel={() => setDragRatio(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(clamp(progress + 0.02, 0, 1));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(clamp(progress - 0.02, 0, 1));
        }
      }}
    >
      <div ref={trackRef} className="relative w-full h-2">
        <div className="skeu-slot">
          <div
            className="skeu-slot__fill"
            style={{ width: `${shown * 100}%` }}
          />
        </div>
        <div className="skeu-cap" style={{ left: `${shown * 100}%` }} />
      </div>
    </div>
  );
};

/** Touche liste de lecture : se verrouille et allume sa LED quand la file est ouverte. */
export const QueueButton: React.FC<{
  active: boolean;
  onClick: () => void;
  size?: number;
}> = ({ active, onClick, size = 56 }) => (
  <button
    type="button"
    onClick={onClick}
    title="Liste de lecture"
    aria-pressed={active}
    data-latched={active}
    className="skeu-key skeu-key--round skeu-key--led"
    style={{ width: size, height: size }}
  >
    <ListBullets size={size * 0.42} weight={active ? "fill" : "bold"} />
  </button>
);

/* -------------------------------------------------------------------------- */
/*  Bouton de contrôle : au clic, panneau d'aperçu et d'options (remplace le disque) */
/* -------------------------------------------------------------------------- */

export const TrackControlWidget: React.FC<{
  track?: Track | null;
  isPlaying: boolean;
  progressRatio: number;
  remainingSeconds: number;
  volume: number;
  isMuted: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSeekRatio: (ratio: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  /** Ouvre la fenêtre miniature (bouton absent/désactivé si non fourni). */
  onMiniature?: () => void;
  size?: number;
}> = ({
  track,
  isPlaying,
  progressRatio,
  remainingSeconds,
  volume,
  isMuted,
  onPrev,
  onNext,
  onPlayPause,
  onSeekRatio,
  onVolumeChange,
  onToggleMute,
  onMiniature,
  size = 56,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const duration = track?.duration || 0;
  const currentSeconds = Math.max(0, duration - remainingSeconds);

  // Fermeture : clic en dehors du widget ou touche Échap
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center">
      {open && (
        <div className="absolute left-0 bottom-full pb-3 z-50">
          <div
            role="dialog"
            aria-label="Panneau de contrôle de lecture"
            className="skeu-panel relative w-80 rounded-2xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {/* En-tête : puits de la pochette + afficheur titre / artiste miniature */}
            <div className="flex items-center gap-3">
              <div className="skeu-well w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center">
                <Waveform
                  size={22}
                  className="text-[#ff9d33]"
                  style={
                    isPlaying
                      ? { filter: "drop-shadow(0 0 5px rgba(255,157,51,0.8))" }
                      : undefined
                  }
                />
              </div>
              <div className="skeu-display rounded-lg flex flex-col min-w-0 flex-1 px-3 py-1.5">
                <span className="skeu-display-text text-sm font-bold truncate">
                  {track?.title || "Aucune piste sélectionnée"}
                </span>
                <span className="text-xs text-[#ff9d33]/60 truncate font-mono">
                  {track?.artist || "Artiste inconnu"}
                </span>
              </div>
            </div>

            {/* Niveau de la chanson : durée écoulée, fader et durée totale */}
            <div className="flex flex-col gap-1 mt-0.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                <span className="skeu-display rounded px-1.5 py-0.5">
                  <span className="skeu-display-text tabular-nums">
                    {formatDuration(currentSeconds)}
                  </span>
                </span>
                <span className="skeu-display rounded px-1.5 py-0.5">
                  <span className="text-[#ff9d33]/60 tabular-nums">
                    {formatDuration(duration)}
                  </span>
                </span>
              </div>
              <SeekLine progress={progressRatio} onSeek={onSeekRatio} />
            </div>

            <div className="skeu-groove" />

            {/* Volume + Précédent, Pause/Play, Suivant */}
            <div className="flex items-center justify-between pb-1">
              <VolumeControl
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={onVolumeChange}
                onToggleMute={onToggleMute}
              />

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onPrev}
                  title="Piste précédente"
                  className="skeu-key skeu-key--rect w-10 h-8"
                >
                  <SkipBack size={16} weight="fill" />
                </button>
                <button
                  type="button"
                  onClick={onPlayPause}
                  title={isPlaying ? "Pause" : "Lecture"}
                  className="skeu-key skeu-key--round skeu-key--amber w-11 h-11"
                >
                  {isPlaying ? (
                    <Pause size={18} weight="fill" />
                  ) : (
                    <Play size={18} weight="fill" className="ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  title="Piste suivante"
                  className="skeu-key skeu-key--rect w-10 h-8"
                >
                  <SkipForward size={16} weight="fill" />
                </button>
              </div>
            </div>

            <div className="skeu-groove" />

            {/* Continuer en miniature : ferme le panneau et ouvre la fenêtre miniature */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onMiniature?.();
              }}
              disabled={!onMiniature}
              title="Continuer la lecture dans une petite fenêtre"
              className="skeu-key skeu-key--rect skeu-key--amber h-11 w-full gap-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lire en Miniature
            </button>

            {/* Vis de fixation du panneau */}
            <span aria-hidden className="skeu-screw absolute top-2 left-2" />
            <span aria-hidden className="skeu-screw absolute top-2 right-2" />
            <span aria-hidden className="skeu-screw absolute bottom-2 left-2" />
            <span aria-hidden className="skeu-screw absolute bottom-2 right-2" />
          </div>
        </div>
      )}

      {/* Bouton de contrôle rond à gauche : enfoncé et LED allumée tant que le panneau est ouvert */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Ouvrir le panneau de contrôle"
        aria-label="Panneau de contrôle de lecture"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-latched={open}
        className="skeu-key skeu-key--round skeu-key--led"
        style={{ width: size, height: size }}
      >
        <NavigationArrowIcon size={size * 0.42} weight={open || isPlaying ? "fill" : "bold"} />
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Dock complet                                                               */
/* -------------------------------------------------------------------------- */

interface PlayerDockProps {
  discTrack?: Track | null;
  isPlaying: boolean;
  progressRatio: number;
  remainingSeconds: number;
  volume: number;
  isMuted: boolean;
  queueOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSeekRatio: (ratio: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onToggleQueue: () => void;
  /** Continuer la lecture dans la fenêtre miniature */
  onMiniature?: () => void;
  /** hauteur CSS du spectre (px) */
  visualizerHeight?: number;
}

export const PlayerDock: React.FC<PlayerDockProps> = ({
  discTrack,
  isPlaying,
  progressRatio,
  remainingSeconds,
  volume,
  isMuted,
  queueOpen,
  onPrev,
  onNext,
  onPlayPause,
  onSeekRatio,
  onVolumeChange,
  onToggleMute,
  onToggleQueue,
  onMiniature,
  visualizerHeight = 90,
}) => {
  const analyser = useAudioAnalyser(
    getPlayerAudioSource,
    isPlaying,
    discTrack?.id,
  );

  return (
    <div className="relative w-full flex-shrink-0 select-none pb-0 mb-0">
      {/* Contrôles au centre : pas de card englobante, les éléments flottent directement */}
      <div className="mx-auto w-2/3 min-w-[420px] max-w-[960px] flex flex-col mb-2 px-4">
        <SeekLine progress={progressRatio} onSeek={onSeekRatio} />
        <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center px-1">
          <div className="justify-self-start">
            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={onVolumeChange}
              onToggleMute={onToggleMute}
            />
          </div>
          <TransportControls
            isPlaying={isPlaying}
            onPrev={onPrev}
            onPlayPause={onPlayPause}
            onNext={onNext}
          />
          <div className="justify-self-end">
            <RemainingTime seconds={remainingSeconds} />
          </div>
        </div>
      </div>

      {/* Spectre : toujours collé en bas, avec un verre + lignes de balayage par-dessus */}
      <div className="relative w-1/2 min-w-[340px] max-w-[680px] mx-auto overflow-hidden p-0 m-0 leading-none">
        <SpectrumVisualizer3D
          analyser={analyser}
          isPlaying={isPlaying}
          height={visualizerHeight}
        />
        <div aria-hidden className="skeu-glass" />
      </div>

      {/* Bouton de contrôle à gauche avec aperçu et options au survol */}
      <div className="absolute left-3 bottom-3 z-30">
        <TrackControlWidget
          track={discTrack}
          isPlaying={isPlaying}
          progressRatio={progressRatio}
          remainingSeconds={remainingSeconds}
          volume={volume}
          isMuted={isMuted}
          onPrev={onPrev}
          onNext={onNext}
          onPlayPause={onPlayPause}
          onSeekRatio={onSeekRatio}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
          onMiniature={onMiniature}
        />
      </div>

      {/* Bouton liste de lecture à droite */}
      <div className="absolute right-3 bottom-3 z-30">
        <QueueButton active={queueOpen} onClick={onToggleQueue} />
      </div>
    </div>
  );
};
