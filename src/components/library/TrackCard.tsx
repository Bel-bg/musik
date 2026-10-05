import React from "react";
import { Play } from "lucide-react";
import { formatDuration, generateFallbackCoverSvg } from "@/lib/utils";
import { hapticAudio } from "@/lib/hapticAudio";
import { useTrackCover } from "@/hooks/useTrackCover";
import type { Track, ScannedTrackMetadata } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques de la carte (autonomes)                             */
/*  Lumière en haut : liseré clair sur le haut des reliefs, sombre sur les     */
/*  creux.                                                                     */
/* -------------------------------------------------------------------------- */

const TRACK_CARD_CSS = `
/* Module en relief (piste normale) */
.skeu-row {
  position: relative;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #2c2f3a 0%, #1c1e26 100%);
  border: 1px solid rgba(0, 0, 0, 0.8);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.14),
    inset 0 -1px 0 rgba(0,0,0,0.5),
    0 2px 0 #0e0f15,
    0 4px 8px rgba(0,0,0,0.45);
  transition: background 150ms, box-shadow 70ms ease-out;
}
.skeu-row:hover {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #353846 0%, #21232c 100%);
}
.skeu-row:active {
  box-shadow:
    inset 0 2px 5px rgba(0,0,0,0.7),
    inset 0 -1px 0 rgba(255,255,255,0.05),
    0 1px 0 #0e0f15,
    0 2px 4px rgba(0,0,0,0.4);
}

/* Piste courante : touche enfoncée, rétro-éclairée */
.skeu-row[data-current="true"] {
  background: linear-gradient(180deg, #14161c 0%, #1d1f27 100%);
  border-color: rgba(255, 157, 51, 0.45);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.85),
    inset 0 -1px 0 rgba(255,255,255,0.05),
    inset 0 0 14px rgba(255,157,51,0.10),
    0 1px 0 #0e0f15,
    0 0 10px rgba(255,157,51,0.15);
}

/* Voyant LED sur le bord gauche */
.skeu-row::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 50%;
  width: 3px;
  height: 14px;
  margin-top: -7px;
  border-radius: 2px;
  background: #3b2a14;
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.6);
  transition: background 150ms, box-shadow 150ms;
}
.skeu-row[data-current="true"]::before {
  background: #ffb259;
  box-shadow: 0 0 6px 1px rgba(255,157,51,0.9);
}

/* Pochette : puits creusé + verre */
.skeu-row__cover {
  position: relative;
  background: #05060a;
  border: 1px solid rgba(0, 0, 0, 0.85);
  box-shadow:
    inset 0 2px 5px rgba(0,0,0,0.9),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-row__cover::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(170deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 40%),
    repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, rgba(0,0,0,0) 1px 3px);
  box-shadow: inset 0 1px 4px rgba(0,0,0,0.7);
}

/* Texte gravé / allumé */
.skeu-row__title {
  color: #e8e9ef;
  text-shadow: 0 -1px 0 rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.06);
}
.skeu-row[data-current="true"] .skeu-row__title {
  color: #ffb259;
  text-shadow: 0 0 6px rgba(255,157,51,0.55);
}
.skeu-row__sub {
  color: #8a8e9e;
  text-shadow: 0 -1px 0 rgba(0,0,0,0.7);
}

/* Durée : mini afficheur sous verre */
.skeu-row__lcd {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.8);
  box-shadow:
    inset 0 2px 4px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(255,255,255,0.03),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-row__lcd::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(170deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 40%),
    repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 1px, rgba(0,0,0,0) 1px 3px);
}
.skeu-row__lcd-text { color: rgba(255,157,51,0.55); }
.skeu-row[data-current="true"] .skeu-row__lcd-text {
  color: #ffb259;
  text-shadow: 0 0 6px rgba(255,157,51,0.55);
}

/* Icône / barres de lecture lumineuses */
.skeu-row__glow { filter: drop-shadow(0 0 5px rgba(255,157,51,0.85)); }

@media (prefers-reduced-motion: reduce) {
  .skeu-row, .skeu-row::before { transition: none; }
}
`;

const TRACK_CARD_STYLE_ID = "skeu-track-card-styles";

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(TRACK_CARD_STYLE_ID) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), { id: TRACK_CARD_STYLE_ID });
  el.textContent = TRACK_CARD_CSS; // réécrit à chaque HMR
  if (!el.isConnected) document.head.appendChild(el);
}

/* -------------------------------------------------------------------------- */
/*  Composant                                                                  */
/* -------------------------------------------------------------------------- */

export interface TrackCardProps {
  track: ScannedTrackMetadata | Track;
  isCurrent?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isCurrent = false,
  isPlaying = false,
  onPlay,
  style,
  className = "",
}) => {
  const { coverUrl, isLoading } = useTrackCover(track);

  const handleClick = () => {
    hapticAudio.playHeavySwitch();
    onPlay?.();
  };

  const cover =
    coverUrl ?? generateFallbackCoverSvg(track.title, track.artist || "");

  return (
    <div
      style={style}
      onClick={handleClick}
      data-current={isCurrent}
      className={`skeu-row group flex items-center gap-3 py-2.5 pr-2.5 pl-4 rounded-xl cursor-pointer select-none ${className}`}
    >
      {/* Pochette dans son puits */}
      <div className="skeu-row__cover w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={cover}
          alt=""
          loading="lazy"
          className={`w-full h-full object-cover transition-opacity ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        />

        <div
          className={`absolute inset-0 z-10 bg-black/55 flex items-center justify-center transition-opacity ${
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isCurrent && isPlaying ? (
            <div className="flex gap-0.5 skeu-row__glow">
              <span className="w-1 h-3.5 bg-[#ffb259] rounded-sm" />
              <span className="w-1 h-3.5 bg-[#ffb259] rounded-sm" />
            </div>
          ) : (
            <Play
              size={16}
              className="text-[#ffb259] fill-current ml-0.5 skeu-row__glow"
            />
          )}
        </div>
      </div>

      {/* Infos gravées */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="skeu-row__title text-xs font-semibold truncate">
          {track.title}
        </span>
        <span className="skeu-row__sub text-[11px] truncate mt-0.5">
          {track.artist || "Artiste inconnu"}
          {track.album && ` • ${track.album}`}
        </span>
      </div>

      {/* Durée dans un mini afficheur */}
      <span className="skeu-row__lcd rounded px-1.5 py-0.5 flex-shrink-0">
        <span className="skeu-row__lcd-text font-mono text-[11px] font-bold tabular-nums">
          {formatDuration(track.duration)}
        </span>
      </span>
    </div>
  );
};
