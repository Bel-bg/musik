import React, { useState } from "react";
import { FolderOpen, Play, Trash2 } from "lucide-react";
import { getCoverImageUrl } from "@/lib/tauri";
import { hapticAudio } from "@/lib/hapticAudio";
import type { Playlist } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques (autonomes, la carte est aussi utilisée en mini)    */
/*  Lumière en haut : liseré clair sur le haut des reliefs, sombre sur les     */
/*  creux.                                                                     */
/* -------------------------------------------------------------------------- */

const VINYL_CARD_CSS = `
/* ---------- Touche (relief, s'enfonce au clic) ---------- */
.skeu-key {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  color: rgba(255, 157, 51, 0.75);
  border: 1px solid rgba(0, 0, 0, 0.7);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 46%, rgba(0,0,0,0.16) 54%, rgba(0,0,0,0.26) 100%),
    linear-gradient(180deg, #3d404c 0%, #272a33 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 3px rgba(0,0,0,0.45),
    0 3px 0 #0e0f15,
    0 6px 10px rgba(0,0,0,0.55);
  transition: transform 70ms ease-out, box-shadow 70ms ease-out, color 150ms;
}
.skeu-key--round { border-radius: 9999px; }
.skeu-key svg {
  filter: drop-shadow(0 -1px 0 rgba(0,0,0,0.85)) drop-shadow(0 1px 0 rgba(255,255,255,0.10));
  transition: filter 150ms;
}
.skeu-key:hover { color: rgba(255, 178, 89, 0.95); }
.skeu-key:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 3px; }
.skeu-key:active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #1b1d24 0%, #262932 100%);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.8),
    inset 0 -1px 0 rgba(255,255,255,0.06),
    0 1px 0 #0e0f15,
    0 2px 5px rgba(0,0,0,0.5);
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

/* Variante danger : s'éclaire en rouge au survol */
.skeu-key--danger:hover { color: #ff6b5e; }
.skeu-key--danger:hover svg { filter: drop-shadow(0 0 5px rgba(255,80,60,0.8)); }

/* ---------- Afficheur sous verre ---------- */
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
.skeu-display::after {
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

/* ---------- Vis de fixation ---------- */
.skeu-screw {
  display: inline-block;
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background:
    linear-gradient(45deg, rgba(0,0,0,0) 44%, rgba(0,0,0,0.75) 44% 56%, rgba(0,0,0,0) 56%),
    radial-gradient(circle at 35% 30%, #8b8f9e 0%, #4a4d5a 55%, #2a2c35 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 1px 1px rgba(0,0,0,0.8),
    0 0 0 1px rgba(0,0,0,0.6);
}

/* ---------- Pochette en carton épais ---------- */
.skeu-vc-sleeve {
  border: 1px solid rgba(0, 0, 0, 0.7);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    inset 1px 0 0 rgba(255,255,255,0.18),
    inset -2px 0 8px rgba(0,0,0,0.7),
    0 2px 0 #0b0c11,
    0 16px 36px -6px rgba(0,0,0,0.85),
    0 6px 16px rgba(0,0,0,0.6);
  transition: transform 300ms ease-out, box-shadow 120ms ease-out;
}
/* Reflet plastique + grain du papier, au-dessus de l'image */
.skeu-vc-sleeve::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 38%),
    repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0 1px, rgba(0,0,0,0) 1px 3px);
}
/* Dos de pochette : pli sombre à gauche, liseré clair juste à côté */
.skeu-vc-sleeve::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 7px;
  z-index: 16;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(255,255,255,0.14) 85%, rgba(0,0,0,0) 100%);
}

/* La carte interactive se soulève au survol et s'enfonce au clic */
.skeu-vc[data-interactive="true"]:hover { z-index: 40; }
.skeu-vc[data-interactive="true"]:hover .skeu-vc-sleeve { transform: scale(1.02); }
.skeu-vc[data-interactive="true"]:active .skeu-vc-sleeve {
  transform: scale(1.005);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.3),
    inset -2px 0 8px rgba(0,0,0,0.7),
    0 1px 0 #0b0c11,
    0 8px 18px -4px rgba(0,0,0,0.8);
}
.skeu-vc:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 6px; border-radius: 6px; }
.skeu-vc:focus-visible,
.skeu-vc:has(:focus-visible) { z-index: 40; }

/* ---------- Disque ---------- */
.skeu-vc-disc {
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 12px 28px rgba(0,0,0,0.8),
    inset 0 0 12px rgba(0,0,0,0.95),
    inset 0 1px 0 rgba(255,255,255,0.12);
}
/* Anneau lisse entre les sillons et l'étiquette */
.skeu-vc-runout {
  position: absolute;
  width: 44%;
  aspect-ratio: 1;
  border-radius: 9999px;
  pointer-events: none;
  background: radial-gradient(circle, #050508 0 90%, rgba(255,255,255,0.10) 92%, rgba(0,0,0,0) 96%);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6);
}
/* Étiquette papier crème */
.skeu-vc-label {
  background:
    repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, rgba(0,0,0,0) 1px 3px),
    radial-gradient(circle at 35% 30%, #fffdf6 0%, #f1ead8 70%, #e0d6bd 100%);
  border: 1px solid rgba(0,0,0,0.25);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    inset 0 -2px 4px rgba(0,0,0,0.15),
    0 0 0 2px rgba(0,0,0,0.5);
}
/* Axe métallique */
.skeu-vc-spindle {
  background: radial-gradient(circle at 35% 30%, #c7cad6 0%, #6b6f7e 55%, #2e303a 100%);
  border: 1px solid rgba(0,0,0,0.6);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.5),
    0 1px 2px rgba(0,0,0,0.6);
}

/* ---------- Pli d'ombre sur la tranche droite de la pochette ---------- */
.skeu-vc-slit {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 10px;
  pointer-events: none;
  background: linear-gradient(270deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0) 100%);
  z-index: 14;
}

/* ---------- Badge subtil d'état en coin (sans masquer la pochette) ---------- */
.skeu-vc-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 18;
  pointer-events: none;
  transition: opacity 200ms ease, transform 200ms ease;
}

/* ---------- TIP : détails + actions, visible uniquement au survol ---------- */
/* Le wrapper porte un padding-top (pas de marge) : aucune zone morte entre la
   pochette et le tip, donc le survol ne se perd pas en y allant avec la souris. */
.skeu-vc-tip {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  min-width: 190px;
  padding-top: 10px;
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-6px) scale(0.97);
  transform-origin: 37% 0;
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out,
    visibility 0s linear 160ms;
}
.skeu-vc[data-interactive="true"]:hover .skeu-vc-tip,
.skeu-vc:focus-visible .skeu-vc-tip,
.skeu-vc:has(:focus-visible) .skeu-vc-tip {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0) scale(1);
  transition-delay: 0s;
}

.skeu-vc-tip__box {
  position: relative;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #2e313c 0%, #1a1c24 100%);
  border: 1px solid rgba(255, 157, 51, 0.4);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.20),
    inset 0 -1px 0 rgba(0,0,0,0.6),
    0 0 14px rgba(255, 157, 51, 0.16),
    0 2px 0 #0b0c11,
    0 14px 28px rgba(0,0,0,0.7);
}
/* Flèche du tip, pointée vers le centre de la pochette */
.skeu-vc-tip__box::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 37%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  transform: rotate(45deg);
  background: #2e313c;
  border-top: 1px solid rgba(255, 157, 51, 0.4);
  border-left: 1px solid rgba(255, 157, 51, 0.4);
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.18);
}

.skeu-vc-groove-subtle {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.7) 15%, rgba(0,0,0,0.7) 85%, transparent 100%);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.skeu-vc-plate__name {
  color: #ffb259;
  text-shadow: 0 -1px 0 rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.08);
}

/* Voyant LED : s'allume pendant la lecture */
.skeu-vc-led {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #3b2a14;
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6);
  transition: background 150ms, box-shadow 150ms;
}
.skeu-vc-led[data-on="true"] {
  background: #ffb259;
  box-shadow: 0 0 6px 1px rgba(255,157,51,0.9), 0 0 0 1px rgba(0,0,0,0.6);
}

@media (prefers-reduced-motion: reduce) {
  .skeu-key, .skeu-key svg, .skeu-vc-sleeve, .skeu-vc-led, .skeu-vc-tip { transition: none; }
}
`;

const VINYL_CARD_STYLE_ID = "skeu-vinyl-card-styles";

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(VINYL_CARD_STYLE_ID) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), { id: VINYL_CARD_STYLE_ID });
  el.textContent = VINYL_CARD_CSS; // réécrit à chaque HMR
  if (!el.isConnected) document.head.appendChild(el);
}

/* -------------------------------------------------------------------------- */
/*  Composant                                                                  */
/* -------------------------------------------------------------------------- */

interface VinylPlaylistCardProps {
  playlist: Playlist;
  onOpen?: (playlistId: string) => void;
  onPlay?: (playlist: Playlist, e: React.MouseEvent) => void;
  onDelete?: (playlist: Playlist, e: React.MouseEvent) => void;
  /** Playlist en cours de lecture : le disque sort de la pochette et tourne en continu. */
  isPlaying?: boolean;
  /** false = affichage seul (miniature) : pas de survol, d'overlay ni de clic. */
  interactive?: boolean;
  /** Affiche le tip (nom + nb de pistes + actions) au survol de la pochette. */
  showCaption?: boolean;
}

export const VinylPlaylistCard: React.FC<VinylPlaylistCardProps> = ({
  playlist,
  onOpen,
  onPlay,
  onDelete,
  isPlaying = false,
  interactive = true,
  showCaption = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const coverUrl = getCoverImageUrl(playlist.cover_path);
  const hovered = interactive && isHovered;
  const extended = hovered || isPlaying;
  const sheenSpin = extended ? "animate-spin [animation-duration:5s]" : "";
  const trackLabel = playlist.track_count === 1 ? "piste" : "pistes";

  const handleClick = () => {
    if (!interactive) return;
    hapticAudio.playToggleSnap();
    onOpen?.(playlist.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive || e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticAudio.playHeavySwitch();
    onPlay?.(playlist, e);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticAudio.playToggleSnap();
    onDelete?.(playlist, e);
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={interactive ? () => setIsHovered(true) : undefined}
      onMouseLeave={interactive ? () => setIsHovered(false) : undefined}
      data-interactive={interactive}
      className={`skeu-vc group relative flex flex-col select-none transition-all duration-300 ${
        interactive ? "cursor-pointer" : ""
      }`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`Bande ${playlist.name}`}
    >
      {/* Composition disque + pochette */}
      <div className="relative w-full aspect-[1.32/1] flex items-center">
        {/* ================= DISQUE (sort de derrière la pochette) ================= */}
        <div
          className={`skeu-vc-disc absolute right-0 top-[3%] bottom-[3%] aspect-square rounded-full transition-all duration-500 ease-out z-0 flex items-center justify-center ${
            extended
              ? "translate-x-0 scale-[1.02]"
              : "-translate-x-4 sm:-translate-x-5 scale-100"
          }`}
          style={{
            background:
              "repeating-radial-gradient(circle at center, #09090c 0px, #09090c 1.2px, #16171f 1.2px, #16171f 2.5px)",
          }}
        >
          {/* Anneau lisse autour de l'étiquette */}
          <div aria-hidden className="skeu-vc-runout" />

          {/* Reflet anisotrope principal */}
          <div
            className={`absolute inset-0 rounded-full pointer-events-none transition-transform duration-[7000ms] ease-linear ${sheenSpin}`}
            style={{
              background:
                "conic-gradient(from 30deg, transparent 0deg, rgba(255,255,255,0.15) 35deg, transparent 75deg, transparent 180deg, rgba(255,255,255,0.11) 215deg, transparent 255deg)",
            }}
          />

          {/* Reflet secondaire croisé */}
          <div
            className={`absolute inset-0 rounded-full pointer-events-none transition-transform duration-[7000ms] ease-linear ${sheenSpin}`}
            style={{
              background:
                "conic-gradient(from 120deg, transparent 0deg, rgba(255,255,255,0.06) 30deg, transparent 60deg, transparent 180deg, rgba(255,255,255,0.04) 210deg, transparent 240deg)",
            }}
          />

          {/* Étiquette centrale : tourne avec le disque en lecture */}
          <div
            className={`skeu-vc-label w-[35%] aspect-square rounded-full flex flex-col items-center justify-center relative p-1 z-10 ${
              isPlaying ? "animate-spin [animation-duration:1.8s]" : ""
            }`}
          >
            {/* Axe métallique */}
            <div className="skeu-vc-spindle w-3.5 h-3.5 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-black/85" />
            </div>

            <span className="text-[6.5px] font-mono font-black text-black tracking-widest mt-0.5 uppercase truncate max-w-[85%] text-center">
              {playlist.name}
            </span>
            <span className="text-[5px] font-mono text-black/50 tracking-wider">
              33 ⅓ RPM
            </span>
          </div>

          {/* Tranche du disque */}
          <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
        </div>

        {/* ================= POCHETTE (carton épais) ================= */}
        <div className="skeu-vc-sleeve relative z-10 w-[74%] aspect-square rounded-[3px] overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={playlist.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-[#f3f4f6] text-black relative flex flex-col justify-between p-3.5 sm:p-4 pl-5 sm:pl-6 shadow-inner">
              {/* Haut gauche : autocollant vintage */}
              <div className="bg-[#111215] text-white p-1.5 rounded-[2px] w-fit max-w-[50%] shadow-md border border-black/50">
                <div className="text-[7.5px] font-black tracking-wider leading-none">
                  MUSIK LP
                </div>
                <div className="text-[5.5px] font-mono text-white/70 leading-tight mt-0.5">
                  HI-FI STEREO
                </div>
                <div className="text-[5px] font-mono text-amber-400 font-bold leading-none mt-1">
                  {playlist.track_count}{" "}
                  {playlist.track_count === 1 ? "PISTE" : "PISTES"}
                </div>
              </div>

              {/* Centre : gros titre */}
              <div className="flex-1 flex flex-col items-center justify-center my-auto px-1">
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tighter text-center uppercase leading-[0.95] break-words line-clamp-3 font-sans">
                  {playlist.name}
                </h2>
                <div className="w-2.5 h-2.5 rounded-full bg-white border border-black/20 shadow-sm mt-3" />
              </div>

              {/* Bas : mentions et code catalogue */}
              <div className="flex items-end justify-between mt-auto pt-1">
                <div className="border border-black px-1 py-0.5 text-[5.5px] font-black tracking-widest uppercase leading-none">
                  PARENTAL ADVISORY
                </div>
                <span className="text-[6px] font-mono text-black/60 font-bold uppercase tracking-wider">
                  MSK-{playlist.id.slice(0, 5).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Fente d'ouverture de la pochette à droite (le disque en sort) */}
          <div aria-hidden className="skeu-vc-slit" />

          {/* Badge discret de statut en coin supérieur (ne masque pas la couverture) */}
          {interactive && isPlaying && (
            <div className="skeu-vc-badge">
              <span className="skeu-display rounded-md px-2 py-0.5 shadow-lg border border-amber-500/40 flex items-center gap-1.5">
                <span className="skeu-vc-led" data-on="true" />
                <span className="skeu-display-text font-mono text-[9px] font-black uppercase tracking-wider">
                  En lecture
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================= TIP AU SURVOL : détails + actions (aucune barre fixe) ================= */}
      {interactive && showCaption && (
        <div className="skeu-vc-tip">
          <div className="skeu-vc-tip__box rounded-lg p-2 flex flex-col gap-1.5">
            {/* Ligne 1 : Nom + Nombre de pistes + LED + Vis */}
            <div className="flex items-center gap-2">
              <span aria-hidden className="skeu-screw" />
              <span
                className="skeu-vc-plate__name flex-1 min-w-0 truncate text-sm font-extrabold tracking-tight"
                title={playlist.name}
              >
                {playlist.name}
              </span>
              <span className="skeu-display rounded px-1.5 py-0.5 flex-shrink-0">
                <span className="skeu-display-text font-mono text-[11px] font-bold tabular-nums">
                  {playlist.track_count} {trackLabel}
                </span>
              </span>
              <span
                aria-hidden
                className="skeu-vc-led"
                data-on={isPlaying}
                title={isPlaying ? "En cours de lecture" : "En pause"}
              />
              <span aria-hidden className="skeu-screw" />
            </div>

            <div className="skeu-vc-groove-subtle" />

            {/* Ligne 2 : Ouvrir / Supprimer / Lire */}
            <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
              <div
                onClick={handleClick}
                className="flex items-center gap-1.5 cursor-pointer min-w-0 flex-1 hover:opacity-90"
                title="Ouvrir la playlist"
              >
                <FolderOpen
                  size={13}
                  className="text-[#ff9d33] flex-shrink-0"
                />
                <span className="text-[10px] font-mono font-bold text-[#ffb259] truncate uppercase tracking-wider">
                  Ouvrir
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  title="Supprimer la playlist"
                  aria-label="Supprimer la playlist"
                  className="skeu-key skeu-key--round skeu-key--danger w-7 h-7"
                >
                  <Trash2 size={12} strokeWidth={2.5} />
                </button>

                <button
                  type="button"
                  onClick={handlePlayClick}
                  title="Lire la playlist"
                  aria-label="Lire la playlist"
                  className="skeu-key skeu-key--round skeu-key--amber w-7 h-7"
                >
                  <Play size={13} className="fill-current translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
