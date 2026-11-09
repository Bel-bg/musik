import React from 'react';
import { Download, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { useUpdaterStore } from '@/store/useUpdaterStore';
import { hapticAudio } from '@/lib/hapticAudio';

export const UpdateBadge: React.FC = () => {
  const {
    status,
    availableVersion,
    downloadProgress,
    isDismissed,
    downloadAndInstall,
    relaunchApp,
    dismissUpdate,
  } = useUpdaterStore();

  if (isDismissed) return null;
  if (status !== 'available' && status !== 'downloading' && status !== 'ready') {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticAudio.playToggleSnap();

    if (status === 'available') {
      downloadAndInstall();
    } else if (status === 'ready') {
      relaunchApp();
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticAudio.playHeavySwitch();
    dismissUpdate();
  };

  return (
    <div className="flex items-center gap-1.5 animate-fadeIn pointer-events-auto">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'downloading'}
        className={`
          group relative flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-bold
          border transition-all duration-150 shadow-md select-none cursor-pointer
          ${
            status === 'ready'
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400 hover:bg-emerald-900/90 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-[#2a221b] border-accent/60 text-accent hover:bg-[#382c22] shadow-[0_0_10px_rgba(255,157,51,0.25)]'
          }
        `}
        title={
          status === 'available'
            ? `Installer la mise à jour v${availableVersion}`
            : status === 'ready'
              ? 'Redémarrer le lecteur'
              : `Téléchargement en cours (${downloadProgress}%)`
        }
      >
        {status === 'available' && (
          <>
            <span className="leading-none text-[11px] tracking-wide">
              v{availableVersion} dispo
            </span>
            <Download size={12} className="opacity-70 group-hover:translate-y-0.5 transition-transform" />
          </>
        )}

        {status === 'downloading' && (
          <>
            <RefreshCw size={12} className="animate-spin text-accent" />
            <span className="leading-none text-[11px] tracking-wide">
              {downloadProgress}%
            </span>
            {/* Barre de progression miniature intégrée en arrière-plan */}
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-accent rounded-full transition-all duration-200"
              style={{ width: `${downloadProgress}%` }}
            />
          </>
        )}

        {status === 'ready' && (
          <>
            <CheckCircle2 size={13} className="text-emerald-400 animate-bounce" />
            <span className="leading-none text-[11px] tracking-wide text-emerald-300">
              Redémarrer
            </span>
          </>
        )}
      </button>

      {status === 'available' && (
        <button
          type="button"
          onClick={handleDismiss}
          className="text-text-muted/60 hover:text-text-primary text-[10px] p-0.5 transition-colors cursor-pointer"
          title="Masquer l'alerte"
          aria-label="Masquer l'alerte de mise à jour"
        >
          ✕
        </button>
      )}
    </div>
  );
};
