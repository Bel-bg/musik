import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";
import { usePlaylistStore } from "@/store/usePlaylistStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { tauriApi } from "@/lib/tauri";
import { hapticAudio } from "@/lib/hapticAudio";
import { openMiniPlayer } from "@/lib/miniPlayer";
import { VirtualizedTrackList } from "@/components/library/VirtualizedTrackList";
import { useTrackCover } from "@/hooks/useTrackCover";
import { CoverDisplay } from "@/components/player/CoverDisplay";
import { PlayerDock } from "@/components/player/PlayerDock";
import type { Track } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Réglages du carrousel — tout se joue ici                                   */
/* -------------------------------------------------------------------------- */

const CARD_RATIO = 0.72; // largeur / hauteur d'une card
const STAGE_HEIGHT_FILL = 0.86; // part de la hauteur de scène occupée par la card centrale
const MAX_SIDE_CARDS = 3; // nb max de cards visibles de chaque côté
const FIRST_GAP = 0.6; // écart centre -> 1re card voisine (en largeur de card)
const NEXT_GAP = 0.32; // écart entre cards voisines suivantes (plus petit = plus de chevauchement)
const SCALE_DROP = 0.13; // perte d'échelle par rang
const TILT_BASE = 34; // inclinaison de la 1re voisine (deg)
const TILT_STEP = 6; // inclinaison ajoutée par rang

const QUEUE_PANEL_W = 380;
const QUEUE_GAP = 16;
const COMPACT_SCALE = 0.74; // taille du carrousel quand la liste est ouverte

const CARD_SPRING = {
  type: "spring",
  stiffness: 240,
  damping: 30,
  mass: 0.9,
} as const;

// Amorti (pas de dépassement) : synchronise la largeur du panneau et le rétrécissement du carrousel
const PANEL_SPRING = { type: "spring", stiffness: 260, damping: 34 } as const;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* -------------------------------------------------------------------------- */
/*  Hooks utilitaires                                                          */
/* -------------------------------------------------------------------------- */

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}

// Artwork flouté plein écran de la piste active (ambiance)
const BlurredBackdrop: React.FC<{ track?: Track | null }> = ({ track }) => {
  const { coverUrl } = useTrackCover(track);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      <AnimatePresence>
        {coverUrl && (
          <motion.img
            key={coverUrl}
            src={coverUrl}
            alt=""
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-[36px] saturate-[1.3] will-change-[opacity]"
          />
        )}
      </AnimatePresence>
      {/* Darkening + vignette to keep UI legible */}
      <div className="absolute inset-0 bg-[#090a0d]/1" />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Card du carrousel                                                          */
/*                                                                             */
/*  Une seule <motion.div> par piste, clé stable = index dans la playlist.     */
/*  Quand l'index actif change, chaque card ne change que d'`offset` : framer  */
/*  interpole x / scale / rotateY depuis sa pose actuelle (interruptible),     */
/*  et le zIndex bascule tout de suite -> la card qui arrive passe PAR-DESSUS  */
/*  celle qui part, dans les deux sens.                                        */
/* -------------------------------------------------------------------------- */

function getPose(offset: number, baseW: number) {
  const abs = Math.abs(offset);
  const dir = Math.sign(offset);
  return {
    x: abs === 0 ? 0 : dir * (baseW * FIRST_GAP + (abs - 1) * baseW * NEXT_GAP),
    scale: 1 - abs * SCALE_DROP,
    rotateY: abs === 0 ? 0 : -dir * (TILT_BASE + (abs - 1) * TILT_STEP),
    // Les cards restent opaques (sinon on voit à travers quand elles se chevauchent) :
    // la profondeur passe par un voile noir, pas par l'opacité.
    shade: abs === 0 ? 0 : Math.min(0.72, 0.2 + (abs - 1) * 0.2),
  };
}

interface CarouselCardProps {
  track: Track;
  offset: number;
  baseW: number;
  baseH: number;
  maxOffset: number;
  onSelect: (offset: number) => void;
}

const CarouselCard: React.FC<CarouselCardProps> = ({
  track,
  offset,
  baseW,
  baseH,
  maxOffset,
  onSelect,
}) => {
  const abs = Math.abs(offset);
  const dir = Math.sign(offset);
  const isCenter = offset === 0;
  const hidden = abs > maxOffset;
  const pose = getPose(offset, baseW);

  return (
   <motion.div
  initial={{
    x: pose.x + dir * baseW * 0.25,
    scale: pose.scale - 0.08,
    rotateY: pose.rotateY,
    opacity: 0,
  }}
  animate={{
    x: pose.x,
    scale: pose.scale,
    rotateY: pose.rotateY,
    opacity: hidden ? 0 : 1,
  }}
  transition={CARD_SPRING}
  onClick={() => onSelect(offset)}
  style={{
    width: baseW,
    height: baseH,
    marginLeft: -baseW / 2,
    marginTop: -baseH / 2,
    zIndex: 100 - abs * 10,
    transformPerspective: 1400,
    pointerEvents: hidden ? "none" : "auto",
  }}
  className={`group absolute left-1/2 top-1/2 cursor-pointer overflow-hidden rounded-[24px] border bg-black will-change-transform transition-shadow duration-300 ${
    isCenter
      ? "border-white/20 shadow-[0_28px_60px_rgba(0,0,0,0.9)]"
      : "border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.8)]"
  }`}
>
  {/* Cover plein cadre */}
  <CoverDisplay
    track={track}
    isGrayscale={abs >= 2}
    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
  />

  {/* Reflet diagonal */}
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      background: isCenter
        ? "linear-gradient(135deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.06) 42%, transparent 56%)"
        : "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 42%, transparent 56%)",
    }}
  />
  {isCenter && (
    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
  )}

  {/* Dégradé sombre + textes */}
  <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-b from-transparent via-black/60 to-black/95 pointer-events-none" />
  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end px-4 pb-4">
    <h2 className="text-[15px] font-semibold text-[#f5c796] tracking-tight truncate w-full text-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
      {track.title}
    </h2>
    <p className="text-xs text-[#a3a7b4] truncate w-full text-center mt-0.5">
      {track.artist || "Artiste inconnu"}
    </p>
  </div>

  {/* Voile de profondeur */}
  <motion.div
    initial={false}
    animate={{ opacity: pose.shade }}
    transition={{ duration: 0.3 }}
    className="absolute inset-0 bg-black pointer-events-none"
  />
</motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Vue principale                                                             */
/* -------------------------------------------------------------------------- */

interface PlaylistCarouselViewProps {
  playlistId: string;
  onBack: () => void;
}

export const PlaylistCarouselView: React.FC<PlaylistCarouselViewProps> = ({
  playlistId,
  onBack,
}) => {
  const {
    playlists,
    activePlaylist,
    activePlaylistTracks,
    loadPlaylistDetail,
    addTracksToPlaylist,
  } = usePlaylistStore();

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playTrack,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
    toggleMute,
  } = usePlayerStore();

  const { addWatchedFolderPath } = useLibraryStore();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showQueueList, setShowQueueList] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);

  const [rowRef, rowSize] = useElementSize<HTMLDivElement>();

  // Load details
  useEffect(() => {
    if (playlistId) {
      loadPlaylistDetail(playlistId);
    }
  }, [playlistId, loadPlaylistDetail]);

  const currentPl =
    activePlaylist || playlists.find((p) => p.id === playlistId);
  const tracks = activePlaylistTracks;

  // Sync activeIndex with currentTrack from playerStore
  useEffect(() => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx !== -1) {
      setActiveIndex(idx);
    }
  }, [currentTrack, tracks]);

  // Index borné (la playlist peut rétrécir pendant un rechargement)
  const index = tracks.length ? Math.min(activeIndex, tracks.length - 1) : 0;

  /* ------------------------------ Navigation ------------------------------ */

  const handlePlayIndex = (idx: number) => {
    if (idx < 0 || idx >= tracks.length) return;
    setActiveIndex(idx);
    hapticAudio.playHeavySwitch();
    playTrack(tracks[idx], tracks, idx);
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    hapticAudio.playToggleSnap();
    if (currentTrack && tracks.some((t) => t.id === currentTrack.id)) {
      nextTrack();
    } else {
      handlePlayIndex((index + 1) % tracks.length);
    }
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    hapticAudio.playToggleSnap();
    if (currentTrack && tracks.some((t) => t.id === currentTrack.id)) {
      prevTrack();
    } else {
      handlePlayIndex((index - 1 + tracks.length) % tracks.length);
    }
  };

  const activeTrack = tracks[index] || currentTrack;
  const isActiveLoaded =
    !!currentTrack && !!activeTrack && currentTrack.id === activeTrack.id;

  // Lecture/pause si la piste active est chargée, sinon on la lance
  const handlePlayActive = () => {
    hapticAudio.playHeavySwitch();
    if (isActiveLoaded) togglePlay();
    else handlePlayIndex(index);
  };

  const handleCardSelect = (offset: number) => {
    if (offset === 0) handlePlayActive();
    else handlePlayIndex(index + offset);
  };

  const handleSeekRatio = (ratio: number) => {
    if (duration <= 0) return;
    seek(ratio * duration);
    hapticAudio.playToggleSnap();
  };

  // Les handlers sont recréés à chaque rendu : on les passe par une ref pour que
  // le listener clavier ne lise jamais un currentTrack / tracks périmé.
  const navRef = useRef({ handleNext, handlePrev });
  navRef.current = { handleNext, handlePrev };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        // A focused <button> would otherwise also fire a click => double toggle
        (document.activeElement as HTMLElement | null)?.blur?.();
        hapticAudio.playHeavySwitch();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        navRef.current.handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        navRef.current.handlePrev();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [togglePlay, volume, setVolume]);

  const lastWheelRef = useRef(0);
  const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tracks.length === 0 || Math.abs(e.deltaY) < 4) return;
    const now = Date.now();
    if (now - lastWheelRef.current < 350) return;
    lastWheelRef.current = now;
    if (e.deltaY < 0) handlePrev();
    else handleNext();
  };

  const handleAddFolder = async () => {
    hapticAudio.playHeavySwitch();
    setIsAddingFolder(true);
    try {
      const folder = await tauriApi.selectFolder();
      if (folder && currentPl) {
        await addWatchedFolderPath(folder);
        const { tracks: allLibTracks } = useLibraryStore.getState();
        const normalized = folder.replace(/\\/g, "/");
        const folderTracks = allLibTracks.filter((t) =>
          t.filepath.replace(/\\/g, "/").startsWith(normalized + "/"),
        );
        if (folderTracks.length > 0) {
          await addTracksToPlaylist(
            currentPl.id,
            folderTracks.map((t) => t.id),
          );
          await loadPlaylistDetail(currentPl.id);
        }
      }
    } catch (err) {
      console.error("Erreur ajout dossier:", err);
    } finally {
      setIsAddingFolder(false);
    }
  };

  /* ------------------------- Géométrie du carrousel ------------------------ */
  // Tout est calculé à partir de la rangée (scène + panneau), dont la taille ne
  // bouge pas quand la liste s'ouvre -> les cards ne "sautent" jamais, seule
  // l'échelle du deck s'anime.

  const geometry = useMemo(() => {
    const stageW = Math.max(
      0,
      rowSize.w - (showQueueList ? QUEUE_PANEL_W + QUEUE_GAP : 0),
    );
    const baseH = clamp(
      Math.min(rowSize.h * STAGE_HEIGHT_FILL, (rowSize.w * 0.4) / CARD_RATIO),
      200,
      640,
    );
    const baseW = baseH * CARD_RATIO;
    const deckScale = Math.min(
      showQueueList ? COMPACT_SCALE : 1,
      (stageW * 0.9) / baseW,
    );

    // Combien de cards de chaque côté tiennent dans la scène ?
    const availHalf = stageW / 2 / deckScale;
    let maxOffset = 0;
    for (let k = 1; k <= MAX_SIDE_CARDS; k++) {
      const edge =
        baseW * (FIRST_GAP + (k - 1) * NEXT_GAP) +
        baseW * (1 - SCALE_DROP * k) * 0.35;
      if (edge <= availHalf) maxOffset = k;
    }

    return { baseW, baseH, deckScale, maxOffset };
  }, [rowSize.w, rowSize.h, showQueueList]);

  const cards: { track: Track; offset: number; idx: number }[] = [];
  for (let o = -(geometry.maxOffset + 1); o <= geometry.maxOffset + 1; o++) {
    const idx = index + o;
    const track = tracks[idx];
    if (track) cards.push({ track, offset: o, idx });
  }

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const remainingSeconds = isActiveLoaded
    ? Math.max(0, (duration || activeTrack?.duration || 0) - currentTime)
    : activeTrack?.duration || 0;
  // Ambient background only once a track is actually loaded in the player
  const backdropTrack = currentTrack ? activeTrack : null;
  const measured = rowSize.w > 0 && rowSize.h > 0;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#090a0d] text-white">
      <BlurredBackdrop track={backdropTrack} />

      <div className="relative z-10 flex flex-col h-full w-full p-4 md:p-6 gap-4">
        {/* Top Bar: Discreet Return to Playlists */}
        <div className="flex items-center justify-between px-2 z-30 flex-shrink-0">
          <button
            onClick={() => {
              hapticAudio.playToggleSnap();
              onBack();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181920] border border-[#2a2c36] text-[#8e92a0] hover:text-[#ff9d33] transition-colors text-xs font-mono tracking-wider shadow-md"
          >
            <ArrowLeft size={28} weight="bold" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-widest text-[#8e92a0] uppercase">
              {currentPl?.name || "PLAYLIST"}
            </span>
            {/* {tracks.length > 0 && (
              <span className="text-[10px] font-mono text-[#ff9d33] bg-[#22180e] px-2 py-0.5 rounded-full border border-[#ff9d33]/30">
                {index + 1}/{tracks.length}
              </span>
            )} */}
          </div>

          <button
            onClick={handleAddFolder}
            disabled={isAddingFolder}
            title="Ajouter un dossier musical à cette bande"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181920] border border-[#2a2c36] text-[#8e92a0] hover:text-[#ff9d33] transition-colors text-xs font-mono"
          >
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>

        {/* Rangée : scène du carrousel + liste de lecture intégrée */}
        <div ref={rowRef} className="relative flex-1 min-h-0 w-full flex">
          {/* Scène (molette : piste précédente / suivante) */}
          <div
            onWheel={handleStageWheel}
            className="relative flex-1 min-w-0 h-full overflow-hidden select-none"
          >
            {tracks.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
                <span className="text-sm font-mono text-[#8e92a0]">
                  Cette bande est vide
                </span>
                <button
                  onClick={handleAddFolder}
                  className="px-4 py-2 rounded-full bg-[#1c1d24] border border-[#2f3240] text-[#ff9d33] text-xs font-mono tracking-wider hover:bg-[#252732] transition-colors"
                >
                  Charger un dossier musical
                </button>
              </div>
            ) : (
              measured && (
                <motion.div
                  initial={false}
                  animate={{ scale: geometry.deckScale }}
                  transition={PANEL_SPRING}
                  className="absolute inset-0"
                >
                  {cards.map(({ track, offset, idx }) => (
                    <CarouselCard
                      key={idx}
                      track={track}
                      offset={offset}
                      baseW={geometry.baseW}
                      baseH={geometry.baseH}
                      maxOffset={geometry.maxOffset}
                      onSelect={handleCardSelect}
                    />
                  ))}
                </motion.div>
              )
            )}
          </div>

          {/* Liste de lecture : dans le flux, la scène se réduit pour lui faire place */}
          <motion.aside
            initial={false}
            animate={{
              width: showQueueList ? QUEUE_PANEL_W : 0,
              marginLeft: showQueueList ? QUEUE_GAP : 0,
              opacity: showQueueList ? 1 : 0,
            }}
            transition={PANEL_SPRING}
            style={{ pointerEvents: showQueueList ? "auto" : "none" }}
            className="flex-shrink-0 h-full overflow-hidden"
            aria-hidden={!showQueueList}
          >
              <VirtualizedTrackList
                  tracks={tracks}
                  currentTrackId={activeTrack?.id}
                  isPlaying={isPlaying}
                  onPlayTrack={(_, idx) => {
                    handlePlayIndex(idx);
                  }}
                />
          </motion.aside>
        </div>

        {/* Dock : disque + spectre 3D + contrôles + liste de lecture */}
        <PlayerDock
          discTrack={currentTrack ?? activeTrack}
          isPlaying={isPlaying}
          progressRatio={progressRatio}
          remainingSeconds={remainingSeconds}
          volume={volume}
          isMuted={isMuted}
          queueOpen={showQueueList}
          onPrev={handlePrev}
          onNext={handleNext}
          onPlayPause={handlePlayActive}
          onSeekRatio={handleSeekRatio}
          onVolumeChange={setVolume}
          onToggleMute={() => {
            hapticAudio.playToggleSnap();
            toggleMute();
          }}
          onToggleQueue={() => {
            hapticAudio.playToggleSnap();
            setShowQueueList((v) => !v);
          }}
          onMiniature={
            currentPl
              ? () => {
                  hapticAudio.playHeavySwitch();
                  void openMiniPlayer(currentPl);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};
