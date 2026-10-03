import React, { useRef, useState } from "react";
import {
  ListBullets,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
  Faders,
  Waveform,
} from "@phosphor-icons/react";
import { formatDuration } from "@/lib/utils";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { getPlayerAudioSource } from "@/lib/audioSource";
import { SpectrumVisualizer3D } from "./SpectrumVisualizer3D";
import type { Track } from "@/types";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const glow = (alpha: number, radius: number): React.CSSProperties => ({
  filter: `drop-shadow(0 0 ${radius}px rgba(255, 157, 51, ${alpha}))`,
});

/* -------------------------------------------------------------------------- */
/*  Briques réutilisables                                                      */
/* -------------------------------------------------------------------------- */

export const TransportControls: React.FC<{
  isPlaying: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
}> = ({ isPlaying, onPrev, onPlayPause, onNext }) => (
  <div className="flex items-center gap-6 text-[#ff9d33]">
    <button
      onClick={onPrev}
      title="Piste précédente"
      className="p-1 hover:text-[#ffb259] active:scale-90 transition-transform"
      style={glow(0.7, 7)}
    >
      <SkipBack size={24} weight="fill" />
    </button>
    <button
      onClick={onPlayPause}
      title={isPlaying ? "Pause" : "Lecture"}
      className="p-1 hover:text-[#ffb259] active:scale-90 transition-transform"
      style={glow(0.85, 10)}
    >
      {isPlaying ? (
        <Pause size={34} weight="fill" />
      ) : (
        <Play size={34} weight="fill" />
      )}
    </button>
    <button
      onClick={onNext}
      title="Piste suivante"
      className="p-1 hover:text-[#ffb259] active:scale-90 transition-transform"
      style={glow(0.7, 7)}
    >
      <SkipForward size={24} weight="fill" />
    </button>
  </div>
);

/** Volume discret : icône atténuée, le curseur se déploie au survol, molette pour ajuster. */
export const VolumeControl: React.FC<{
  volume: number;
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}> = ({ volume, isMuted, onVolumeChange, onToggleMute }) => {
  const effective = isMuted ? 0 : volume;
  return (
    <div
      className="group flex items-center gap-1 text-[#ff9d33]/40 hover:text-[#ff9d33]/90 focus-within:text-[#ff9d33]/90 transition-colors"
      onWheel={(e) => {
        e.stopPropagation();
        onVolumeChange(clamp(volume + (e.deltaY < 0 ? 0.05 : -0.05), 0, 1));
      }}
    >
      <button
        onClick={onToggleMute}
        title="Volume (molette pour ajuster)"
        className="p-1 active:scale-95 transition-transform"
      >
        {effective === 0 ? (
          <SpeakerSlash size={18} weight="fill" />
        ) : (
          <SpeakerHigh size={18} weight="fill" />
        )}
      </button>
      <div className="w-0 group-hover:w-24 group-focus-within:w-24 overflow-hidden transition-[width] duration-300 flex items-center">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effective}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-24 h-1 appearance-none rounded-full bg-white/10 accent-[#ff9d33] cursor-pointer"
        />
      </div>
    </div>
  );
};

export const RemainingTime: React.FC<{ seconds: number }> = ({ seconds }) => (
  <span
    title="Temps restant"
    className="font-mono text-xs font-bold tabular-nums text-[#ff9d33]/60"
    style={{ textShadow: "0 0 6px rgba(255, 157, 51, 0.4)" }}
  >
    -{formatDuration(seconds)}
  </span>
);

/** Fine ligne de progression cliquable (zone de clic élargie, img s'épaissit au survol). */
export const SeekLine: React.FC<{
  progress: number;
  onSeek: (ratio: number) => void;
}> = ({ progress, onSeek }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Position dans le morceau"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      title="Cliquer pour naviguer dans le morceau"
      onClick={(e) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        onSeek(clamp((e.clientX - rect.left) / rect.width, 0, 1));
      }}
      className="group relative flex items-center h-3 cursor-pointer"
    >
      <div className="relative w-full h-[3px] group-hover:h-[5px] transition-[height] rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#ff9d33]"
          style={{
            width: `${progress * 100}%`,
            boxShadow: "0 0 8px #ff9d33",
          }}
        />
      </div>
    </div>
  );
};

export const QueueButton: React.FC<{
  active: boolean;
  onClick: () => void;
  size?: number;
}> = ({ active, onClick, size = 56 }) => (
  <button
    onClick={onClick}
    title="Liste de lecture"
    aria-pressed={active}
    className={`flex items-center justify-center rounded-full border transition-all active:scale-95 ${
      active
        ? "bg-[#181920]/80 border-white/10 text-[#ff9d33]/80 hover:text-[#ffb259] hover:border-[#ff9d33]/30"
        : "bg-[#181920]/80 border-white/10 text-[#ff9d33]/80 hover:text-[#ffb259] hover:border-[#ff9d33]/30"
    }`}
    style={{
      width: size,
      height: size,
      boxShadow: active
        ? "0 0 18px rgba(255,157,51,0.35)"
        : "0 0 18px rgba(255,157,51,0.35)",
    }}
  >
    <ListBullets size={size * 0.42} weight={active ? "fill" : "bold"} />
  </button>
);

/* -------------------------------------------------------------------------- */
/*  Bouton de contrôle avec aperçu et options au survol (remplace le disque)    */
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
  size = 56,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const duration = track?.duration || 0;
  const currentSeconds = Math.max(0, duration - remainingSeconds);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Panneau d'aperçu du niveau et options au survol */}
      {isHovered && (
        <div
          className="absolute left-0 bottom-16 w-80 rounded-2xl bg-[#0e1017]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-4 flex flex-col gap-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            boxShadow:
              "0 20px 45px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* En-tête : Miniature de la pochette + Titre + Artiste */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#161822] border border-white/10 flex-shrink-0 flex items-center justify-center shadow-md">
              <Waveform size={22} className="text-[#ff9d33]" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-bold text-white truncate">
                {track?.title || "Aucune piste sélectionnée"}
              </span>
              <span className="text-xs text-[#ff9d33]/80 truncate font-mono">
                {track?.artist || "Artiste inconnu"}
              </span>
            </div>
          </div>

          {/* Niveau de la chanson : durée écoulée, curseur et durée totale */}
          <div className="flex flex-col gap-1.5 mt-0.5">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-text-muted">
              <span className="text-[#ff9d33]">
                {formatDuration(currentSeconds)}
              </span>
              <span>{formatDuration(duration)}</span>
            </div>
            <SeekLine progress={progressRatio} onSeek={onSeekRatio} />
          </div>

          {/* Options de contrôle : Volume + Précédent, Pause/Play, Suivant */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] mt-0.5">
            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={onVolumeChange}
              onToggleMute={onToggleMute}
            />

            <div className="flex items-center gap-3 text-[#ff9d33]">
              <button
                type="button"
                onClick={onPrev}
                title="Piste précédente"
                className="p-1 hover:text-[#ffb259] active:scale-90 transition-transform"
              >
                <SkipBack size={18} weight="fill" />
              </button>
              <button
                type="button"
                onClick={onPlayPause}
                title={isPlaying ? "Pause" : "Lecture"}
                className="w-9 h-9 rounded-full bg-[#ff9d33] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_0_14px_rgba(255,157,51,0.55)]"
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
                className="p-1 hover:text-[#ffb259] active:scale-90 transition-transform"
              >
                <SkipForward size={18} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bouton de contrôle rond à gauche */}
      <button
        type="button"
        onClick={onPlayPause}
        title="Contrôles de lecture & niveau (survoler pour le panneau complet)"
        aria-label="Contrôle de lecture"
        aria-pressed={isPlaying}
        className={`flex items-center justify-center rounded-full border transition-all active:scale-95 ${
          isPlaying
            ? "bg-[#181920]/80 border-white/10 text-[#ff9d33]/80 hover:text-[#ffb259] hover:border-[#ff9d33]/30"
            : "bg-[#181920]/80 border-white/10 text-[#ff9d33]/80 hover:text-[#ffb259] hover:border-[#ff9d33]/30"
        }`}
        style={{
          width: size,
          height: size,
          boxShadow: isPlaying
            ? "0 0 18px rgba(255,157,51,0.35)"
            : "0 8px 20px rgba(0,0,0,0.5)",
        }}
      >
        <Faders size={size * 0.42} weight={isPlaying ? "fill" : "bold"} />
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
  visualizerHeight = 90,
}) => {
  const analyser = useAudioAnalyser(
    getPlayerAudioSource,
    isPlaying,
    discTrack?.id,
  );

  return (
    <div className="relative w-full flex-shrink-0 select-none pb-0 mb-0">
      {/* Contrôles au centre : barre épurée sans card englobante */}
      <div className="mx-auto w-2/3 min-w-[420px] max-w-[960px] flex flex-col mb-1 px-4">
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

      {/* Spectre visuel : centré, environ la moitié de la largeur, collé à même le bas */}
      <div className="w-1/2 min-w-[340px] max-w-[680px] mx-auto overflow-hidden p-0 m-0 leading-none">
        <SpectrumVisualizer3D
          analyser={analyser}
          isPlaying={isPlaying}
          height={visualizerHeight}
        />
      </div>

      {/* Bouton de contrôle à gauche avec aperçu et options au survol */}
      <div className="absolute left-0 bottom-0 z-30">
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
        />
      </div>

      {/* Bouton liste de lecture à droite */}
      <div className="absolute right-0 bottom-0 z-30">
        <QueueButton active={queueOpen} onClick={onToggleQueue} />
      </div>
    </div>
  );
};
