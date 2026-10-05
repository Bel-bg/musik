import React, { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowsOutSimple } from "@phosphor-icons/react";
import { VinylPlaylistCard } from "@/components/home/VinylPlaylistCard";
import { TransportControls } from "@/components/player/PlayerDock";
import { hapticAudio } from "@/lib/hapticAudio";
import {
  EVT_CMD,
  EVT_STATE,
  type MiniCommand,
  type MiniState,
} from "@/lib/miniPlayer";

const send = (cmd: MiniCommand) => emit(EVT_CMD, cmd);

/**
 * Contenu de la fenêtre miniature (taille fixe). Pas d'audio ici : c'est une
 * télécommande skeuomorphique de la fenêtre principale, avec le disque vinyle
 * de la playlist qui tourne tant que la lecture est en cours.
 */
export const MiniPlayerWindow: React.FC = () => {
  const [state, setState] = useState<MiniState | null>(null);

  useEffect(() => {
    let un: (() => void) | undefined;
    let disposed = false;
    listen<MiniState>(EVT_STATE, (e) => setState(e.payload)).then((fn) => {
      if (disposed) return fn();
      un = fn;
      // Handshake : l'écouteur est prêt, on demande l'état courant.
      void send("ready");
    });
    return () => {
      disposed = true;
      un?.();
    };
  }, []);

  const restore = async () => {
    hapticAudio.playToggleSnap();
    await send("restore");
    await getCurrentWindow().close();
  };

  const command = (cmd: MiniCommand, heavy = false) => {
    if (heavy) hapticAudio.playHeavySwitch();
    else hapticAudio.playToggleSnap();
    void send(cmd);
  };

  const isPlaying = state?.isPlaying ?? false;

  return (
    <div className="skeu-panel h-screen w-screen flex flex-col overflow-hidden rounded-2xl select-none text-white">
      {/* Barre de titre : zone de déplacement + plaque gravée + bouton agrandir */}
      <div
        data-tauri-drag-region
        className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
      >
        {/* Gauche : vis */}
        <div className="flex items-center justify-start pointer-events-none">
          <span className="skeu-screw" />
        </div>

        {/* Centre : titre */}
        <div className="flex justify-center min-w-0 pointer-events-none">
          <span className="skeu-display rounded px-2 py-0.5 max-w-full">
            <span className="skeu-display-text block truncate text-center font-mono text-[10px] font-bold tracking-[0.2em]">
              {state?.title ?? "Aucune piste"}
            </span>
          </span>
        </div>

        {/* Droite : bouton */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={restore}
            title="Revenir à la fenêtre principale"
            aria-label="Revenir à la fenêtre principale"
            className="skeu-key skeu-key--round w-8 h-8"
          >
            <ArrowsOutSimple size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className="skeu-groove mx-3" />

      {/* Pochette + disque vinyle (même composant que l'accueil) dans un puits creusé */}
      <div className="skeu-well !bg-transparent mx-3 mt-3 rounded-xl p-3 flex-shrink-0">
        {state?.playlist ? (
          <VinylPlaylistCard
            playlist={state.playlist}
            isPlaying={isPlaying}
            interactive={false}
            showCaption={false}
          />
        ) : (
          <div className="aspect-[1.32/1] flex items-center justify-center font-mono text-xs text-[#ff9d33]/60">
            Chargement…
          </div>
        )}
      </div>

      {/* Afficheur titre / artiste sous verre */}
      <div className="skeu-display rounded-lg mx-3 mt-3 px-3 py-1.5 flex flex-col min-w-0">
        <span className="skeu-display-text text-sm font-bold truncate">
          {state?.title ?? "Aucune piste"}
        </span>
        <span className="text-xs text-[#ff9d33]/60 truncate font-mono">
          {state?.artist ?? state?.playlist?.name ?? "Inconnu"}
        </span>
        <div aria-hidden className="skeu-glass" />
      </div>

      {/* Progression (lecture seule) */}
      <div className="mx-4 mt-3 relative h-2 flex-shrink-0">
        <div className="skeu-slot">
          <div
            className="skeu-slot__fill"
            style={{ width: `${(state?.progress ?? 0) * 100}%` }}
          />
        </div>
      </div>

      {/* Touches de transport */}
      <div className="flex-1 flex items-center justify-center">
        <TransportControls
          isPlaying={isPlaying}
          onPrev={() => command("prev")}
          onPlayPause={() => command("toggle", true)}
          onNext={() => command("next")}
        />
      </div>
    </div>
  );
};
