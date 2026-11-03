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
/*  une télécommande skeuomorphique : elle reçoit l'état et renvoie des         */
/*  commandes (lecture, pause, pistes, navigation/seek, volume, mute).         */
/* -------------------------------------------------------------------------- */

export const MINI_LABEL = "mini";
export const MINI_SIZE = { width: 340, height: 530 } as const;

export const EVT_STATE = "mini:state"; // main -> mini
export const EVT_CMD = "mini:cmd"; // mini -> main

export interface MiniState {
  playlist: Playlist | null;
  title: string | null;
  artist: string | null;
  isPlaying: boolean;
  progress: number; // 0..1
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
}

export type MiniCommand =
  | "ready"
  | "prev"
  | "next"
  | "toggle"
  | "restore"
  | "close"
  | "toggle-mute"
  | "toggle-shuffle"
  | { type: "seek"; ratio: number }
  | { type: "set-volume"; volume: number };

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

/* ----------------- Canal de secours Web (BroadcastChannel) ---------------- */

let webChannel: BroadcastChannel | null = null;
function getWebChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!webChannel) {
    webChannel = new BroadcastChannel("musik_mini_bridge");
  }
  return webChannel;
}

/** Envoi d'événement compatible Tauri et Web */
export async function sendMiniEvent<T>(eventName: string, payload: T): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await emit(eventName, payload);
    } catch (e) {
      console.warn("[miniPlayer] Tauri emit warning:", e);
    }
  }
  const channel = getWebChannel();
  channel?.postMessage({ event: eventName, payload });
}

/** Écoute d'événement compatible Tauri et Web */
export async function listenMiniEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  let unlistenTauri: UnlistenFn | undefined;

  if (isTauriEnvironment()) {
    try {
      unlistenTauri = await listen<T>(eventName, (e) => handler(e.payload));
    } catch (e) {
      console.warn("[miniPlayer] Tauri listen warning:", e);
    }
  }

  const channel = getWebChannel();
  const onWebMessage = (e: MessageEvent) => {
    if (e.data && e.data.event === eventName) {
      handler(e.data.payload as T);
    }
  };
  channel?.addEventListener("message", onWebMessage);

  return () => {
    unlistenTauri?.();
    channel?.removeEventListener("message", onWebMessage);
  };
}

/* ------------------------------ Ouverture --------------------------------- */

/** Ouvre (ou ramène au premier plan) la fenêtre miniature. */
export async function openMiniPlayer(playlist: Playlist): Promise<void> {
  useMiniPlayerStore.getState().setSession(playlist, true);

  if (!isTauriEnvironment()) {
    // Mode Web / Navigateur : popup fenêtrée avec dimensions exactes
    const popup = window.open(
      `${window.location.origin}${window.location.pathname}?mini=1`,
      "musik_mini_window",
      `width=${MINI_SIZE.width},height=${MINI_SIZE.height},menubar=no,toolbar=no,location=no,status=no,resizable=no`,
    );
    if (popup) popup.focus();
    return;
  }

  const existing = await WebviewWindow.getByLabel(MINI_LABEL);
  if (existing) {
    await existing.unminimize().catch(() => {});
    await existing.show().catch(() => {});
    await existing.setFocus().catch(() => {});
    return;
  }

  // Lecture de la préférence d'épinglage sauvegardée (défaut : true)
  const savedAlwaysOnTop =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("musik_mini_always_on_top") !== "false"
      : true;

  const win = new WebviewWindow(MINI_LABEL, {
    url: "index.html?mini=1",
    title: "MUSIK Mini",
    width: MINI_SIZE.width,
    height: MINI_SIZE.height,
    resizable: false,
    maximizable: false,
    minimizable: true,
    decorations: false,
    alwaysOnTop: savedAlwaysOnTop,
    center: true,
    backgroundColor: "#0b0c10",
    shadow: true,
  });

  win.once("tauri://error", (e) => {
    console.error("[miniPlayer] création impossible", e);
    useMiniPlayerStore.getState().setSession(null, false);
  });
}

/** Côté fenêtre principale : ramène l'app au premier plan. */
async function restoreMainWindow(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const main = getCurrentWindow();
      await main.unminimize();
      await main.show();
      await main.setFocus();
    } catch (e) {
      console.warn("[miniPlayer] Impossible de restaurer la fenêtre principale:", e);
    }
  } else {
    window.focus();
  }
}

/* -------------------------------------------------------------------------- */
/*  Pont côté fenêtre principale                                               */
/* -------------------------------------------------------------------------- */

function buildState(): MiniState {
  const { currentTrack, isPlaying, currentTime, duration, volume, isMuted, shuffle } =
    usePlayerStore.getState();
  const { playlist } = useMiniPlayerStore.getState();
  return {
    playlist,
    title: currentTrack?.title ?? null,
    artist: currentTrack?.artist ?? null,
    isPlaying,
    progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
    currentTime: currentTime || 0,
    duration: duration || 0,
    volume: volume ?? 1,
    isMuted: isMuted ?? false,
    shuffle: shuffle ?? false,
  };
}

/**
 * À démarrer une fois dans la fenêtre principale. Retourne la fonction de nettoyage.
 */
export function startMiniPlayerBridge(): () => void {
  let disposed = false;
  const unlisteners: (() => void)[] = [];
  let lastSent = 0;
  let lastKey = "";

  const push = (force = false) => {
    if (!useMiniPlayerStore.getState().isOpen) return;
    const state = buildState();
    const key = `${state.playlist?.id}|${state.title}|${state.isPlaying}|${Math.round(state.currentTime * 2)}|${Math.round(state.volume * 100)}|${state.isMuted}|${state.shuffle}`;
    const now = Date.now();
    if (!force && key === lastKey && now - lastSent < 250) return;
    lastKey = key;
    lastSent = now;
    void sendMiniEvent(EVT_STATE, state);
  };

  const unsubPlayer = usePlayerStore.subscribe(() => push());
  const unsubMini = useMiniPlayerStore.subscribe(() => push(true));

  const onCommand = async (cmd: MiniCommand) => {
    const player = usePlayerStore.getState();

    if (typeof cmd === "object" && cmd !== null) {
      if (cmd.type === "seek") {
        if (player.duration > 0) {
          player.seek(cmd.ratio * player.duration);
        }
      } else if (cmd.type === "set-volume") {
        player.setVolume(cmd.volume);
      }
      return;
    }

    switch (cmd) {
      case "ready": {
        // La miniature est prête : on passe la main et on réduit la fenêtre principale
        push(true);
        if (isTauriEnvironment()) {
          try {
            await getCurrentWindow().minimize();
          } catch {}
        }
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
      case "toggle-mute":
        player.toggleMute();
        break;
      case "toggle-shuffle":
        player.toggleShuffle();
        break;
      case "restore": {
        useMiniPlayerStore.getState().setSession(null, false);
        await restoreMainWindow();
        break;
      }
      case "close": {
        useMiniPlayerStore.getState().setSession(null, false);
        await restoreMainWindow();
        break;
      }
    }
  };

  void listenMiniEvent<MiniCommand>(EVT_CMD, (payload) => void onCommand(payload)).then(
    (un) => (disposed ? un() : unlisteners.push(un)),
  );

  return () => {
    disposed = true;
    unsubPlayer();
    unsubMini();
    unlisteners.forEach((un) => un());
  };
}
