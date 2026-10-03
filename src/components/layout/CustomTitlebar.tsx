import React, { memo, useCallback, useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { isTauriEnvironment } from "@/lib/tauri";
import { hapticAudio } from "@/lib/hapticAudio";
import titleBg from "../../../assets/title.png";

// Cached window handle (resolved once, only inside Tauri).
let cachedWindow: Window | null = null;
const getAppWindow = (): Window | null => {
  if (cachedWindow) return cachedWindow;
  if (!isTauriEnvironment()) return null;
  cachedWindow = getCurrentWindow();
  return cachedWindow;
};

const btnBase =
  "w-8 h-7 flex items-center justify-center rounded text-text-muted transition-colors border-0 shadow-none outline-none focus:outline-none focus-visible:outline-none hover:bg-white/10";

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
        // Avoid leaking the listener if the component unmounted before it resolved.
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
    // isMaximized state is updated by the onResized listener.
    getAppWindow()?.toggleMaximize().catch(console.error);
  }, []);

  const handleClose = useCallback(() => {
    hapticAudio.playHeavySwitch();
    getAppWindow()?.close().catch(console.error);
  }, []);

  return (
    <div
  data-tauri-drag-region
  className="h-10 flex items-center justify-between px-3 select-none z-50 relative overflow-hidden bg-cover bg-center border-0 shadow-none outline-none"
  style={{
    backgroundImage: `url(${titleBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }}
>
      {/* Left: Brand (draggable) */}
      {/* <div data-tauri-drag-region className="flex items-center gap-2">
        <img
          src="/musik.png"
          alt=""
          data-tauri-drag-region
          className="w-18 h-12 object-contain rounded-sm"
        />
      </div> */}

      {/* Center: Draggable Spacer */}
      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* Right: Desktop Window Controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleMinimize}
          title="Réduire"
          aria-label="Réduire"
          className={`${btnBase} hover:text-text-primary`}
        >
          <Minus size={12} />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          title={isMaximized ? "Restaurer" : "Agrandir"}
          aria-label={isMaximized ? "Restaurer" : "Agrandir"}
          className={`${btnBase} hover:text-text-primary`}
        >
          {isMaximized ? <Copy size={11} /> : <Square size={11} />}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="Fermer"
          aria-label="Fermer"
          className={`${btnBase} hover:text-white hover:bg-red-600/80`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
});

CustomTitlebar.displayName = "CustomTitlebar";
