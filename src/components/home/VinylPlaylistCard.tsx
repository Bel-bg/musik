import React, { useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { getCoverImageUrl } from '@/lib/tauri';
import { hapticAudio } from '@/lib/hapticAudio';
import type { Playlist } from '@/types';

interface VinylPlaylistCardProps {
  playlist: Playlist;
  onOpen: (playlistId: string) => void;
  onPlay: (playlist: Playlist, e: React.MouseEvent) => void;
  onDelete: (playlist: Playlist, e: React.MouseEvent) => void;
}

export const VinylPlaylistCard: React.FC<VinylPlaylistCardProps> = ({
  playlist,
  onOpen,
  onPlay,
  onDelete,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const coverUrl = getCoverImageUrl(playlist.cover_path);

  const handleClick = () => {
    hapticAudio.playToggleSnap();
    onOpen(playlist.id);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticAudio.playHeavySwitch();
    onPlay(playlist, e);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticAudio.playToggleSnap();
    onDelete(playlist, e);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col cursor-pointer select-none transition-all duration-300"
      role="button"
      tabIndex={0}
      aria-label={`Bande ${playlist.name}`}
    >
      {/* Vinyl & Sleeve Composition Container */}
      <div className="relative w-full aspect-[1.32/1] flex items-center">
        {/* ================= VINYL RECORD (Slides out from behind sleeve) ================= */}
        <div
          className={`absolute right-0 top-[3%] bottom-[3%] aspect-square rounded-full transition-all duration-500 ease-out z-0 flex items-center justify-center ${
            isHovered
              ? 'translate-x-0 scale-[1.02]'
              : '-translate-x-4 sm:-translate-x-5 scale-100'
          }`}
          style={{
            boxShadow:
              '0 12px 28px rgba(0, 0, 0, 0.8), inset 0 0 12px rgba(0, 0, 0, 0.95)',
            background:
              'repeating-radial-gradient(circle at center, #09090c 0px, #09090c 1.2px, #16171f 1.2px, #16171f 2.5px)',
          }}
        >
          {/* Sillons & Anisotropic Light Sheen (Reflection) */}
          <div
            className={`absolute inset-0 rounded-full pointer-events-none transition-transform duration-[7000ms] ease-linear ${
              isHovered ? 'animate-spin [animation-duration:5s]' : ''
            }`}
            style={{
              background:
                'conic-gradient(from 30deg, transparent 0deg, rgba(255,255,255,0.15) 35deg, transparent 75deg, transparent 180deg, rgba(255,255,255,0.11) 215deg, transparent 255deg)',
            }}
          />

          {/* Secondary Cross-Sheen */}
          <div
            className={`absolute inset-0 rounded-full pointer-events-none transition-transform duration-[7000ms] ease-linear ${
              isHovered ? 'animate-spin [animation-duration:5s]' : ''
            }`}
            style={{
              background:
                'conic-gradient(from 120deg, transparent 0deg, rgba(255,255,255,0.06) 30deg, transparent 60deg, transparent 180deg, rgba(255,255,255,0.04) 210deg, transparent 240deg)',
            }}
          />

          {/* White Center Label (matching the reference image) */}
          <div className="w-[35%] aspect-square rounded-full bg-[#f8f9fa] shadow-inner border border-black/15 flex flex-col items-center justify-center relative p-1 z-10">
            {/* Center Spindle Hole */}
            <div className="w-3.5 h-3.5 rounded-full bg-[#090a0d] border border-black/30 shadow-inner flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-black/80" />
            </div>

            {/* Label Typography */}
            <span className="text-[6.5px] font-mono font-black text-black tracking-widest mt-0.5 uppercase truncate max-w-[85%] text-center">
              {playlist.name}
            </span>
            <span className="text-[5px] font-mono text-black/50 tracking-wider">
              33 ⅓ RPM
            </span>
          </div>

          {/* Outer vinyl edge rim */}
          <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
        </div>

        {/* ================= ALBUM SLEEVE (Front Square Pocket) ================= */}
        <div
          className="relative z-10 w-[74%] aspect-square rounded-[3px] overflow-hidden transition-all duration-300 group-hover:scale-[1.02] border border-white/10"
          style={{
            boxShadow:
              '0 16px 36px -6px rgba(0, 0, 0, 0.85), 0 6px 16px rgba(0, 0, 0, 0.6), inset -2px 0 8px rgba(0, 0, 0, 0.7)',
          }}
        >
          {coverUrl ? (
            /* Custom Playlist Cover Image */
            <img
              src={coverUrl}
              alt={playlist.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            /* Minimalist White Sleeve exactly inspired by user reference image ("PURE ME") */
            <div className="w-full h-full bg-[#f3f4f6] text-black relative flex flex-col justify-between p-3.5 sm:p-4 shadow-inner">
              {/* Top Left: Vintage Vinyl Sticker Badge */}
              <div className="bg-[#111215] text-white p-1.5 rounded-[2px] w-fit max-w-[50%] shadow-md border border-black/50">
                <div className="text-[7.5px] font-black tracking-wider leading-none">
                  MUSIK LP
                </div>
                <div className="text-[5.5px] font-mono text-white/70 leading-tight mt-0.5">
                  HI-FI STEREO
                </div>
                <div className="text-[5px] font-mono text-amber-400 font-bold leading-none mt-1">
                  {playlist.track_count} {playlist.track_count === 1 ? 'PISTE' : 'PISTES'}
                </div>
              </div>

              {/* Center: Big Bold Typography like 'PURE ME' */}
              <div className="flex-1 flex flex-col items-center justify-center my-auto px-1">
                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tighter text-center uppercase leading-[0.95] break-words line-clamp-3 font-sans">
                  {playlist.name}
                </h2>
                {/* Center dot like in the user's reference image */}
                <div className="w-2.5 h-2.5 rounded-full bg-white border border-black/20 shadow-sm mt-3" />
              </div>

              {/* Bottom Badges: Parental Advisory & Catalog code */}
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

          {/* Sleeve Open Edge Shadow on right (illusion that vinyl slides out of inside) */}
          <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-gradient-to-l from-black/50 to-transparent pointer-events-none" />

          {/* ================= HOVER OVERLAY (Play, Actions & Info) ================= */}
          <div className="absolute inset-0 z-20 bg-black/65 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-3.5">
            {/* Top row: Track count badge & Delete button */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-accent bg-black/75 px-2 py-0.5 rounded border border-accent/40 shadow-sm">
                {playlist.track_count} {playlist.track_count === 1 ? 'piste' : 'pistes'}
              </span>

              <button
                type="button"
                onClick={handleDeleteClick}
                title="Supprimer la playlist"
                aria-label="Supprimer la playlist"
                className="p-1.5 rounded-lg bg-black/70 hover:bg-red-600/90 text-text-muted hover:text-white transition-all border border-white/10 active:scale-90"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Center: Glowing Play Button */}
            <div className="flex items-center justify-center my-auto">
              <button
                type="button"
                onClick={handlePlayClick}
                title="Lire la playlist"
                aria-label="Lire la playlist"
                className="w-12 h-12 rounded-full bg-accent text-background flex items-center justify-center shadow-[0_0_22px_rgba(245,158,11,0.65)] hover:scale-115 active:scale-95 transition-all"
              >
                <Play size={22} className="fill-current translate-x-0.5 text-black" />
              </button>
            </div>

            {/* Bottom: Info prompt */}
            <div className="flex flex-col">
              <span className="text-xs font-black text-white truncate drop-shadow">
                {playlist.name}
              </span>
              <span className="text-[10px] text-accent/90 font-mono font-semibold">
                Ouvrir
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Caption beneath the card */}
      <div className="mt-2.5 flex items-center justify-between px-1 w-[74%]">
        <span className="text-sm font-extrabold text-text-primary group-hover:text-accent transition-colors truncate">
          {playlist.name}
        </span>
        <span className="text-xs font-mono text-text-subtle font-bold ml-2 flex-shrink-0">
          {playlist.track_count} tr.
        </span>
      </div>
    </div>
  );
};
