import { create } from "zustand";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriEnvironment } from "@/lib/tauri";
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePlaylistStore } from "@/store/usePlaylistStore";
import type { Playlist } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Contrat entre les deux fenêtres                                            */
/*                                                                             */
/*  L'audio reste dans la fenêtre principale (AudioEngine). La miniature est   */
/*  une simple télécommande : elle reçoit l'état et renvoie des commandes.     */
/* -------------------------------------------------------------------------- */

export const MINI_LABEL = "mini";
export const MINI_SIZE = { width: 340, height: 500 } as const;

export const EVT_STATE = "mini:state"; // main -> mini
export const EVT_CMD = "mini:cmd"; // mini -> main

export interface MiniState {
  playlist: Playlist | null;
  title: string | null;
  artist: string | null;
  isPlaying: boolean;
  progress: number; // 0..1
}

export type MiniCommand = "ready" | "prev" | "next" | "toggle" | "restore";

/* ------------------------------ Store (main) ------------------------------ */

interface MiniPlayerStore {
  playlist: Playlist | null;
  isOpen: boolean;
  setSession: (playlist: Playlist | null, isOpen: boolean) => void;
}

export const useMiniPlayerStore = create<MiniPlayerStore>((set) => ({
  playlist: null,
  isOpen: false,
  setSession: (playlist, isOpen) => set({ playlist, isOpen }),
}));

/* ------------------------------ Ouverture --------------------------------- */

/** Ouvre (ou ramène au premier plan) la fenêtre miniature. */
export async function openMiniPlayer(playlist: Playlist): Promise<void> {
  if (!isTauriEnvironment()) return;

  useMiniPlayerStore.getState().setSession(playlist, true);

  const existing = await WebviewWindow.getByLabel(MINI_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const win = new WebviewWindow(MINI_LABEL, {
    url: "index.html?mini=1",
    title: "MUSIK Mini",
    width: MINI_SIZE.width,
    height: MINI_SIZE.height,
    resizable: false,
    maximizable: false,
    minimizable: false,
    decorations: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: "#0b0c10",
  });

  win.once("tauri://error", (e) => {
    console.error("[miniPlayer] création impossible", e);
    useMiniPlayerStore.getState().setSession(null, false);
  });
}

/** Côté fenêtre principale : ramène l'app au premier plan. */
async function restoreMainWindow(): Promise<void> {
  const main = getCurrentWindow();
  await main.unminimize();
  await main.show();
  await main.setFocus();
}

/* -------------------------------------------------------------------------- */
/*  Pont côté fenêtre principale                                               */
/* -------------------------------------------------------------------------- */

function buildState(): MiniState {
  const { currentTrack, isPlaying, currentTime, duration } =
    usePlayerStore.getState();
  const { playlist } = useMiniPlayerStore.getState();
  return {
    playlist,
    title: currentTrack?.title ?? null,
    artist: currentTrack?.artist ?? null,
    isPlaying,
    progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
  };
}

/**
 * À démarrer une fois dans la fenêtre principale. Retourne la fonction de nettoyage.
 */
export function startMiniPlayerBridge(): () => void {
  if (!isTauriEnvironment()) return () => {};

  let disposed = false;
  const unlisteners: UnlistenFn[] = [];
  let lastSent = 0;
  let lastKey = "";

  const push = (force = false) => {
    if (!useMiniPlayerStore.getState().isOpen) return;
    const state = buildState();
    // L'état "lourd" (piste, lecture) part tout de suite ; la progression est limitée à ~4/s.
    const key = `${state.playlist?.id}|${state.title}|${state.isPlaying}`;
    const now = Date.now();
    if (!force && key === lastKey && now - lastSent < 250) return;
    lastKey = key;
    lastSent = now;
    void emit(EVT_STATE, state);
  };

  const unsubPlayer = usePlayerStore.subscribe(() => push());
  const unsubMini = useMiniPlayerStore.subscribe(() => push(true));

  const onCommand = async (cmd: MiniCommand) => {
    const player = usePlayerStore.getState();
    switch (cmd) {
      case "ready": {
        // La miniature est prête : on passe la main et on réduit la fenêtre principale.
        push(true);
        await getCurrentWindow().minimize();
        break;
      }
      case "toggle": {
        if (!player.currentTrack) {
          const tracks = usePlaylistStore.getState().activePlaylistTracks;
          if (tracks.length > 0) player.playTrack(tracks[0], tracks, 0);
        } else {
          player.togglePlay();
        }
        break;
      }
      case "prev":
        player.prevTrack();
        break;
      case "next":
        player.nextTrack();
        break;
      case "restore": {
        useMiniPlayerStore.getState().setSession(null, false);
        await restoreMainWindow();
        break;
      }
    }
  };

  void listen<MiniCommand>(EVT_CMD, (e) => void onCommand(e.payload)).then(
    (un) => (disposed ? un() : unlisteners.push(un)),
  );

  return () => {
    disposed = true;
    unsubPlayer();
    unsubMini();
    unlisteners.forEach((un) => un());
  };
}
