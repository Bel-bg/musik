import React, { memo, useCallback, useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { isTauriEnvironment } from "@/lib/tauri";
import { hapticAudio } from "@/lib/hapticAudio";

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques de la barre de titre (autonomes)                    */
/* -------------------------------------------------------------------------- */

const TITLEBAR_CSS = `
/* Barre : métal brossé, liseré clair en haut, rainure sombre en bas */
.skeu-titlebar {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #2c2f3a 0%, #1a1c24 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.16),
    inset 0 -1px 0 rgba(0,0,0,0.6),
    0 1px 0 rgba(255,255,255,0.06);
}

/* Touche en relief, s'enfonce au clic */
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

/* Touche "Fermer" : s'éclaire en rouge au survol */
.skeu-key--danger:hover { color: #ff6b5e; }
.skeu-key--danger:hover svg { filter: drop-shadow(0 0 5px rgba(255,80,60,0.8)); }

/* Vis de fixation */
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
  .skeu-key, .skeu-key svg { transition: none; }
}
`;

const TITLEBAR_STYLE_ID = "skeu-titlebar-styles";

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(TITLEBAR_STYLE_ID) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), { id: TITLEBAR_STYLE_ID });
  el.textContent = TITLEBAR_CSS; // réécrit à chaque HMR
  if (!el.isConnected) document.head.appendChild(el);
}

/* -------------------------------------------------------------------------- */
/*  Fenêtre Tauri                                                              */
/* -------------------------------------------------------------------------- */

// Cached window handle (resolved once, only inside Tauri).
let cachedWindow: Window | null = null;
const getAppWindow = (): Window | null => {
  if (cachedWindow) return cachedWindow;
  if (!isTauriEnvironment()) return null;
  cachedWindow = getCurrentWindow();
  return cachedWindow;
};

/* -------------------------------------------------------------------------- */
/*  Composant                                                                  */
/* -------------------------------------------------------------------------- */

export const CustomTitlebar: React.FC = memo(() => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getAppWindow();
    if (!appWindow) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = () =>
      appWindow
        .isMaximized()
        .then((max) => !disposed && setIsMaximized(max))
        .catch(() => {});

    sync();
    appWindow
      .onResized(sync)
      .then((fn) => {
        // Évite de fuiter le listener si le composant est démonté avant la résolution.
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const handleMinimize = useCallback(() => {
    hapticAudio.playToggleSnap();
    getAppWindow()?.minimize().catch(console.error);
  }, []);

  const handleToggleMaximize = useCallback(() => {
    hapticAudio.playToggleSnap();
    // isMaximized est mis à jour par le listener onResized.
    getAppWindow()?.toggleMaximize().catch(console.error);
  }, []);

  const handleClose = useCallback(() => {
    hapticAudio.playHeavySwitch();
    getAppWindow()?.close().catch(console.error);
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="skeu-titlebar h-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 select-none z-50 relative"
    >
      {/* Gauche : vis de fixation */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-start pointer-events-none"
      >
        <span aria-hidden className="skeu-screw" />
      </div>

      {/* Centre : zone de drag (vide, ou mets ton titre ici) */}
      <div data-tauri-drag-region className="h-full min-w-[40px]" />

      {/* Droite : touches de fenêtre */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleMinimize}
          title="Réduire"
          aria-label="Réduire"
          className="skeu-key skeu-key--round w-7 h-7"
        >
          <Minus size={12} strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          title={isMaximized ? "Restaurer" : "Agrandir"}
          aria-label={isMaximized ? "Restaurer" : "Agrandir"}
          className="skeu-key skeu-key--round w-7 h-7"
        >
          {isMaximized ? (
            <Copy size={11} strokeWidth={2.5} />
          ) : (
            <Square size={11} strokeWidth={2.5} />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="Fermer"
          aria-label="Fermer"
          className="skeu-key skeu-key--round skeu-key--danger w-7 h-7"
        >
          <X size={13} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
});

CustomTitlebar.displayName = "CustomTitlebar";
