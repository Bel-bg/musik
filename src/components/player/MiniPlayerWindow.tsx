import React, { useEffect, useState, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowsOutSimple,
  PushPin,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
  Shuffle,
} from "@phosphor-icons/react";
import { Minus, X } from "lucide-react";
import { VinylPlaylistCard } from "@/components/home/VinylPlaylistCard";
import { hapticAudio } from "@/lib/hapticAudio";
import { isTauriEnvironment } from "@/lib/tauri";
import { formatDuration } from "@/lib/utils";
import {
  EVT_CMD,
  EVT_STATE,
  sendMiniEvent,
  listenMiniEvent,
  type MiniCommand,
  type MiniState,
} from "@/lib/miniPlayer";

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques autonomes pour la fenêtre miniature                 */
/* -------------------------------------------------------------------------- */

const MINI_STYLE_ID = "skeu-miniplayer-styles";
const MINI_CSS = `
/* ---------- Panneau principal métal brossé ---------- */
.skeu-mini-panel {
  position: relative;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #252832 0%, #171821 100%);
  border: 1px solid rgba(0, 0, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.18),
    inset 0 -1px 0 rgba(0,0,0,0.7),
    0 0 0 1px rgba(255,255,255,0.05),
    0 24px 48px rgba(0,0,0,0.85);
}

/* ---------- Barre de titre métal brossé ---------- */
.skeu-mini-titlebar {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #323542 0%, #1f212a 100%);
  border-bottom: 1px solid rgba(0,0,0,0.8);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.2),
    0 1px 0 rgba(255,255,255,0.06);
}

/* ---------- Rainure creusée ---------- */
.skeu-groove {
  height: 2px;
  background: linear-gradient(180deg, rgba(0,0,0,0.7) 50%, rgba(255,255,255,0.08) 50%);
}

/* ---------- Vis de châssis ---------- */
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

/* ---------- Bouton / Touche en relief ---------- */
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
    linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 46%, rgba(0,0,0,0.16) 54%, rgba(0,0,0,0.26) 100%),
    linear-gradient(180deg, #3d404c 0%, #272a33 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 3px rgba(0,0,0,0.45),
    0 2px 0 #0e0f15,
    0 4px 8px rgba(0,0,0,0.55);
  transition: transform 70ms ease-out, box-shadow 70ms ease-out, color 150ms;
}
.skeu-key--round { border-radius: 9999px; }
.skeu-key--rect  { border-radius: 8px; }

.skeu-key svg {
  filter: drop-shadow(0 -1px 0 rgba(0,0,0,0.85)) drop-shadow(0 1px 0 rgba(255,255,255,0.10));
  transition: filter 150ms;
}
.skeu-key:hover { color: rgba(255, 178, 89, 0.95); }
.skeu-key:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 2px; }

/* Enfoncé au clic ou enclenché (verrouillé) */
.skeu-key:active,
.skeu-key[data-latched="true"] {
  transform: translateY(1.5px);
  background: linear-gradient(180deg, #1b1d24 0%, #262932 100%);
  box-shadow:
    inset 0 2px 5px rgba(0,0,0,0.8),
    inset 0 -1px 0 rgba(255,255,255,0.06),
    0 1px 0 #0e0f15,
    0 2px 4px rgba(0,0,0,0.5);
  color: #ffb259;
}

/* Bouton fermer : rouge d'alerte */
.skeu-key--danger:hover { color: #ff6b5e; }
.skeu-key--danger:hover svg { filter: drop-shadow(0 0 5px rgba(255,80,60,0.8)); }

/* Voyant LED au sommet de la touche */
.skeu-key--led::after {
  content: "";
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  background: #3a2212;
  box-shadow: inset 0 1px 1px rgba(0,0,0,0.8);
  transition: background 150ms, box-shadow 150ms;
}
.skeu-key--led[data-latched="true"]::after {
  background: #ff9d33;
  box-shadow: 0 0 6px #ff9d33, 0 0 10px rgba(255,157,51,0.7);
}

/* Touche ambre principale (Play/Pause) */
.skeu-key--amber {
  color: #2a1500;
  background: linear-gradient(180deg, #ffc98a 0%, #ff9d33 52%, #e07a12 100%);
  border-color: rgba(60, 25, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 -2px 3px rgba(120,50,0,0.45),
    0 2px 0 #7a3a05,
    0 4px 8px rgba(0,0,0,0.6),
    0 0 12px rgba(255,157,51,0.3);
}
.skeu-key--amber svg { filter: drop-shadow(0 1px 0 rgba(255,255,255,0.35)); }
.skeu-key--amber:hover { color: #1a0d00; filter: brightness(1.05); }
.skeu-key--amber:active,
.skeu-key--amber[data-latched="true"] {
  transform: translateY(1.5px);
  background: linear-gradient(180deg, #e88f25 0%, #d9780f 100%);
  box-shadow:
    inset 0 2px 5px rgba(90,35,0,0.7),
    0 1px 0 #7a3a05,
    0 2px 4px rgba(0,0,0,0.5);
  color: #2a1500;
}

/* ---------- Afficheur sous verre ---------- */
.skeu-display {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.75);
  box-shadow:
    inset 0 2px 5px rgba(0,0,0,0.9),
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

/* ---------- Fader / Rainure de progression ---------- */
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
  box-shadow: 0 0 8px rgba(255,157,51,0.7);
}
.skeu-cap {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 18px;
  border-radius: 3px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(0, 0, 0, 0.8);
  background:
    linear-gradient(90deg, rgba(0,0,0,0) 0 4px, #ffb259 4px 6px, rgba(0,0,0,0) 6px),
    linear-gradient(180deg, #8a8e9b 0%, #4a4d5a 48%, #2e303a 52%, #424552 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 2px 4px rgba(0,0,0,0.8);
  pointer-events: none;
}
`;

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(MINI_STYLE_ID) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), { id: MINI_STYLE_ID });
  el.textContent = MINI_CSS;
  if (!el.isConnected) document.head.appendChild(el);
}

const send = (cmd: MiniCommand) => sendMiniEvent(EVT_CMD, cmd);

/**
 * MiniPlayerWindow : Fenêtre miniature autonome et télécommande skeuomorphique.
 * Intègre toutes les capacités d'une fenêtre native (Épingler / Toujours au premier plan,
 * Réduire, Agrandir/Restaurer, Fermer, Déplacement par glisser, Seek interactif, Volume et Mute).
 */
export const MiniPlayerWindow: React.FC = () => {
  const [state, setState] = useState<MiniState | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(true);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [showVolumePopup, setShowVolumePopup] = useState<boolean>(false);
  const seekTrackRef = useRef<HTMLDivElement>(null);

  // Synchronisation de l'état d'épinglage natif au démarrage
  useEffect(() => {
    let disposed = false;
    if (isTauriEnvironment()) {
      const win = getCurrentWindow();
      win
        .isAlwaysOnTop()
        .then((pinned) => {
          if (!disposed) setIsPinned(pinned);
        })
        .catch(() => {
          const saved = localStorage.getItem("musik_mini_always_on_top");
          if (saved !== null && !disposed) {
            const val = saved !== "false";
            setIsPinned(val);
            win.setAlwaysOnTop(val).catch(() => {});
          }
        });
    } else {
      const saved = localStorage.getItem("musik_mini_always_on_top");
      if (saved !== null) setIsPinned(saved !== "false");
    }
    return () => {
      disposed = true;
    };
  }, []);

  // Écoute de l'état en provenance de la fenêtre principale
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    listenMiniEvent<MiniState>(EVT_STATE, (payload) => {
      if (!disposed) setState(payload);
    }).then((fn) => {
      if (disposed) return fn();
      unlisten = fn;
      void send("ready");
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  /* ---------------------- Actions de fenêtre native ---------------------- */

  // Bascule Épinglé / Détaché (Always On Top)
  const togglePin = async () => {
    hapticAudio.playToggleSnap();
    const nextState = !isPinned;
    setIsPinned(nextState);
    try {
      localStorage.setItem("musik_mini_always_on_top", String(nextState));
      if (isTauriEnvironment()) {
        await getCurrentWindow().setAlwaysOnTop(nextState);
      }
    } catch (err) {
      console.warn("[MiniPlayer] togglePin warning:", err);
    }
  };

  // Réduire la fenêtre dans la barre des tâches de l'OS
  const handleMinimize = async () => {
    hapticAudio.playToggleSnap();
    if (isTauriEnvironment()) {
      try {
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn("[MiniPlayer] minimize warning:", err);
      }
    }
  };

  // Restaurer vers la fenêtre principale MUSIK
  const handleRestore = async () => {
    hapticAudio.playToggleSnap();
    await send("restore");
    if (isTauriEnvironment()) {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.warn("[MiniPlayer] restore/close warning:", err);
      }
    } else {
      window.close();
    }
  };

  // Fermer la fenêtre miniature
  const handleClose = async () => {
    hapticAudio.playHeavySwitch();
    await send("close");
    if (isTauriEnvironment()) {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.warn("[MiniPlayer] close warning:", err);
      }
    } else {
      window.close();
    }
  };

  // Déplacement natif de la fenêtre au clic-glisser
  const handleStartDragging = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, [role='slider'], input")) return;
    if (isTauriEnvironment()) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  /* ------------------- Commandes de lecture audio ------------------------ */

  const command = (cmd: MiniCommand, heavy = false) => {
    if (heavy) hapticAudio.playHeavySwitch();
    else hapticAudio.playToggleSnap();
    void send(cmd);
  };

  // Calcul du ratio de progression pour le Seek interactif
  const getSeekRatio = useCallback((clientX: number): number => {
    const el = seekTrackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, raw));
  }, []);

  const handleSeekPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = getSeekRatio(e.clientX);
    setDragRatio(ratio);
  };

  const handleSeekPointerMove = (e: React.PointerEvent) => {
    if (dragRatio === null) return;
    const ratio = getSeekRatio(e.clientX);
    setDragRatio(ratio);
  };

  const handleSeekPointerUp = (e: React.PointerEvent) => {
    if (dragRatio === null) return;
    const ratio = getSeekRatio(e.clientX);
    setDragRatio(null);
    hapticAudio.playToggleSnap();
    void send({ type: "seek", ratio });
  };

  /* ------------------- Raccourcis clavier natifs ------------------------- */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si un champ texte est ciblé
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault();
        command("toggle", true);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        command("prev");
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        command("next");
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        void togglePin();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        command("toggle-shuffle");
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        command("toggle-mute");
      } else if (e.code === "Escape") {
        e.preventDefault();
        void handleRestore();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const currentVol = state?.volume ?? 1;
        void send({ type: "set-volume", volume: Math.min(1, currentVol + 0.05) });
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const currentVol = state?.volume ?? 1;
        void send({ type: "set-volume", volume: Math.max(0, currentVol - 0.05) });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, isPinned]);

  const isPlaying = state?.isPlaying ?? false;
  const currentProgress = dragRatio ?? state?.progress ?? 0;
  const duration = state?.duration ?? 0;
  const currentTime =
    dragRatio !== null ? dragRatio * duration : (state?.currentTime ?? 0);
  const volume = state?.volume ?? 0.8;
  const isMuted = state?.isMuted ?? false;

  return (
    <div
      className="skeu-mini-panel h-screen w-screen flex flex-col overflow-hidden select-none text-white touch-none"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* -------------------- BARRE DE TITRE NATIVE -------------------- */}
      <div
        data-tauri-drag-region
        onPointerDown={handleStartDragging}
        className="skeu-mini-titlebar h-10 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing flex-shrink-0 z-30"
      >
        {/* Gauche : Vis + Bouton Épingler (Pin/Always on top) */}
        <div className="flex items-center gap-2">
          <span aria-hidden className="skeu-screw pointer-events-none" />
          <button
            type="button"
            onClick={togglePin}
            title={
              isPinned
                ? "Détacher du premier plan (cliquer pour désactiver l'épinglage)"
                : "Épingler au premier plan (toujours au-dessus des autres fenêtres)"
            }
            aria-label={
              isPinned
                ? "Détacher la fenêtre miniature"
                : "Épingler la fenêtre miniature au premier plan"
            }
            aria-pressed={isPinned}
            data-latched={isPinned}
            className="skeu-key skeu-key--round skeu-key--led w-7 h-7"
          >
            <PushPin size={13} weight={isPinned ? "fill" : "bold"} />
          </button>
        </div>

        {/* Centre : Plaque gravée affichant le statut ou le titre */}
        <div className="flex-1 px-2 flex justify-center min-w-0 pointer-events-none">
          <span className="skeu-display rounded px-2.5 py-0.5 max-w-[170px] flex items-center justify-center">
            <span className="skeu-display-text block truncate font-mono text-[9px] font-bold tracking-[0.18em] uppercase">
              {state?.title ? state.title : "MUSIK Mini"}
            </span>
          </span>
        </div>

        {/* Droite : Boutons de fenêtre Réduire, Restaurer, Fermer */}
        <div className="flex items-center gap-1.5">
          {/* Réduire */}
          <button
            type="button"
            onClick={handleMinimize}
            title="Réduire dans la barre des tâches"
            aria-label="Réduire la fenêtre miniature"
            className="skeu-key skeu-key--round w-7 h-7"
          >
            <Minus size={11} strokeWidth={3} />
          </button>

          {/* Agrandir / Restaurer */}
          <button
            type="button"
            onClick={handleRestore}
            title="Agrandir vers la fenêtre principale"
            aria-label="Restaurer la fenêtre principale"
            className="skeu-key skeu-key--round w-7 h-7"
          >
            <ArrowsOutSimple size={12} weight="bold" />
          </button>

          {/* Fermer */}
          <button
            type="button"
            onClick={handleClose}
            title="Fermer le mini player"
            aria-label="Fermer le mini player"
            className="skeu-key skeu-key--round skeu-key--danger w-7 h-7"
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="skeu-groove" />

      {/* ----------------- DISQUE VINYLE & POCHETTE ----------------- */}
      <div className="mx-3 mt-2 rounded-xl p-2.5 flex-shrink-0 flex items-center justify-center">
        {state?.playlist ? (
          <div className="w-full max-w-[270px]">
            <VinylPlaylistCard
              playlist={state.playlist}
              isPlaying={isPlaying}
              interactive={false}
              showCaption={false}
            />
          </div>
        ) : (
          <div className="aspect-[1.32/1] w-full max-w-[270px] flex items-center justify-center font-mono text-xs text-[#ff9d33]/60 skeu-display rounded-xl">
            En attente de piste…
          </div>
        )}
      </div>

      {/* ---------------- AFFICHEUR TITRE & ARTISTE ---------------- */}
      <div className="skeu-display rounded-lg mx-3 mt-1.5 px-3 py-1.5 flex flex-col min-w-0 flex-shrink-0">
        <span className="skeu-display-text text-xs font-black truncate tracking-wide">
          {state?.title ?? "Aucune piste sélectionnée"}
        </span>
        <span className="text-[10px] text-[#ff9d33]/70 truncate font-mono tracking-wider">
          {state?.artist ?? state?.playlist?.name ?? "MUSIK Player"}
        </span>
        <div aria-hidden className="skeu-glass" />
      </div>

      {/* ----------- PROGRESSION & SEEK INTERACTIF NATIF ------------ */}
      <div className="mx-4 mt-2.5 flex flex-col gap-1 flex-shrink-0">
        {/* Barre de seek interactive */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position dans le morceau"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(currentProgress * 100)}
          title="Cliquer ou glisser pour naviguer dans le morceau"
          ref={seekTrackRef}
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerCancel={() => setDragRatio(null)}
          className="relative h-4 flex items-center cursor-pointer touch-none"
        >
          <div className="skeu-slot h-2 w-full">
            <div
              className="skeu-slot__fill"
              style={{ width: `${Math.min(100, Math.max(0, currentProgress * 100))}%` }}
            />
          </div>
          <div
            className="skeu-cap"
            style={{
              left: `${Math.min(100, Math.max(0, currentProgress * 100))}%`,
            }}
          />
        </div>

        {/* Compteurs temporels sous verre */}
        <div className="flex items-center justify-between text-[10px] font-mono text-[#ff9d33]/80 px-0.5">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* ----------- TOUCHES DE TRANSPORT & VOLUME RAPIDE ----------- */}
      <div className="flex-1 flex items-center justify-between px-4 pb-2 pt-1">
        <div className="flex items-center gap-1.5">
          {/* Contrôle rapide du volume */}
          <div className="relative">
            <button
              type="button"
              onClick={() => command("toggle-mute")}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowVolumePopup(!showVolumePopup);
              }}
              title={
                isMuted
                  ? "Son coupé (cliquer pour réactiver)"
                  : `Volume: ${Math.round(volume * 100)}% (clic droit ou survol pour régler)`
              }
              aria-label={isMuted ? "Réactiver le son" : "Couper le son"}
              data-latched={isMuted}
              className="skeu-key skeu-key--round w-8 h-8"
            >
              {isMuted || volume === 0 ? (
                <SpeakerSlash size={14} weight="fill" />
              ) : (
                <SpeakerHigh size={14} weight="fill" />
              )}
            </button>

            {/* Mini popup de réglage volume au survol/clic */}
            {showVolumePopup && (
              <div
                className="skeu-mini-panel absolute bottom-10 left-0 p-2 rounded-lg z-50 flex items-center gap-2 shadow-2xl"
                onPointerLeave={() => setShowVolumePopup(false)}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) =>
                    send({ type: "set-volume", volume: parseFloat(e.target.value) })
                  }
                  className="w-20 accent-[#ff9d33] cursor-pointer"
                />
                <span className="font-mono text-[9px] text-[#ff9d33]">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Mode Aléatoire */}
          <button
            type="button"
            onClick={() => command("toggle-shuffle")}
            title={
              state?.shuffle
                ? "Mode aléatoire ACTIF (cliquer pour désactiver et lire dans l'ordre)"
                : "Lecture dans l'ordre (cliquer pour activer le mode aléatoire)"
            }
            aria-label="Mode aléatoire"
            aria-pressed={state?.shuffle ?? false}
            data-latched={state?.shuffle ?? false}
            className="skeu-key skeu-key--round skeu-key--led w-8 h-8"
          >
            <Shuffle size={13} weight={state?.shuffle ? "bold" : "regular"} />
          </button>
        </div>

        {/* Touches de transport Précédent, Lecture/Pause, Suivant */}
        <div className="flex items-center gap-2">
          {/* Précédent */}
          <button
            type="button"
            onClick={() => command("prev")}
            title="Piste précédente (Flèche gauche)"
            aria-label="Piste précédente"
            className="skeu-key skeu-key--rect w-11 h-9"
          >
            <SkipBack size={18} weight="fill" />
          </button>

          {/* Lecture / Pause */}
          <button
            type="button"
            onClick={() => command("toggle", true)}
            title={isPlaying ? "Mettre en pause (Espace)" : "Lire (Espace)"}
            aria-label={isPlaying ? "Mettre en pause" : "Lire"}
            data-latched={isPlaying}
            className="skeu-key skeu-key--rect skeu-key--amber w-14 h-11"
          >
            {isPlaying ? (
              <Pause size={22} weight="fill" />
            ) : (
              <Play size={22} weight="fill" />
            )}
          </button>

          {/* Suivant */}
          <button
            type="button"
            onClick={() => command("next")}
            title="Piste suivante (Flèche droite)"
            aria-label="Piste suivante"
            className="skeu-key skeu-key--rect w-11 h-9"
          >
            <SkipForward size={18} weight="fill" />
          </button>
        </div>

        {/* Indicateur d'état épuré */}
        <div className="w-8 flex items-center justify-end">
          <span
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: isPlaying ? "#ff9d33" : "#3a2212",
              boxShadow: isPlaying ? "0 0 6px #ff9d33" : "none",
            }}
            title={isPlaying ? "Lecture en cours" : "En pause"}
          />
        </div>
      </div>
    </div>
  );
};
