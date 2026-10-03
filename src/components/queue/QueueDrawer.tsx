import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ArrowUp, ArrowDown, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { CoverArt } from '@/components/common/CoverArt';
import { EqualizerBars } from '@/components/common/EqualizerBars';
import { hapticAudio } from '@/lib/hapticAudio';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = usePlayerStore();

  const upcomingTracks = queue.slice(queueIndex + 1);

  const handleClose = () => {
    hapticAudio.playToggleSnap();
    onClose();
  };

  const handleClear = () => {
    hapticAudio.playHeavySwitch();
    clearQueue();
  };

  const handleRemove = (index: number) => {
    hapticAudio.playToggleSnap();
    removeFromQueue(index);
  };

  const handleReorder = (from: number, to: number) => {
    hapticAudio.playRatchetTick();
    reorderQueue(from, to);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop on small screens */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          />

          {/* Drawer Container - Large Machined Console Side-Rack */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 h-[calc(100vh-144px)] w-[420px] skeuo-panel shadow-2xl z-40 flex flex-col select-none border-l border-[#202430] metal-grain"
          >
            {/* Header with Title and Close button */}
            <div className="flex items-center justify-between p-5 border-b border-[#202430] bg-surface-cavity/70">
              <div className="flex items-center gap-2.5">
                <ListMusic size={18} className="text-accent" />
                <span className="text-sm font-mono font-extrabold uppercase tracking-wider text-text-primary">
                  FILE D'ATTENTE DE BANDE
                </span>
              </div>

              <button
                onClick={handleClose}
                aria-label="Fermer le panneau"
                className="p-1.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
              {/* Current Playing Track Plate */}
              {currentTrack && (
                <div className="flex flex-col gap-2.5">
                  <span className="meta-label text-accent font-mono text-xs">TÊTE DE LECTURE ACTIVE</span>
                  <div className="flex items-center gap-3.5 p-3.5 rounded-xl skeuo-recessed border border-accent/30 shadow-md">
                    <CoverArt
                      coverPath={currentTrack.cover_path}
                      title={currentTrack.title}
                      artist={currentTrack.artist}
                      size="sm"
                      className="w-12 h-12 rounded-lg object-cover shadow-sm"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-extrabold text-accent truncate vfd-glow">
                        {currentTrack.title}
                      </span>
                      <span className="text-xs text-text-muted truncate font-semibold mt-0.5">
                        {currentTrack.artist}
                      </span>
                    </div>
                    <EqualizerBars isPlaying={isPlaying} />
                  </div>
                </div>
              )}

              {/* Upcoming Queue */}
              <div className="flex flex-col gap-2.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="meta-label font-mono text-xs">
                    PISTES EN SUITE ({upcomingTracks.length})
                  </span>
                  {upcomingTracks.length > 0 && (
                    <button
                      onClick={handleClear}
                      className="text-xs font-mono font-bold text-text-muted hover:text-red-400 transition-colors uppercase tracking-wider"
                    >
                      Purger la file
                    </button>
                  )}
                </div>

                {upcomingTracks.length === 0 ? (
                  <div className="text-center py-16 skeuo-recessed rounded-xl border border-border/40">
                    <p className="text-xs text-text-subtle font-mono uppercase tracking-wider font-bold">
                      Fin de bande atteinte.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {upcomingTracks.map((track, i) => {
                      const realIndex = queueIndex + 1 + i;

                      return (
                        <div
                          key={`${track.id}-${i}`}
                          className="group flex items-center gap-3 p-2.5 rounded-xl skeuo-recessed hover:border-accent/40 transition-all border border-transparent"
                        >
                          <CoverArt
                            coverPath={track.cover_path}
                            title={track.title}
                            artist={track.artist}
                            size="sm"
                            className="w-10 h-10 rounded-md object-cover shadow-sm"
                          />

                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold text-text-primary truncate">
                              {track.title}
                            </span>
                            <span className="text-[11px] text-text-muted truncate font-medium">
                              {track.artist}
                            </span>
                          </div>

                          {/* Mechanical Reorder & Remove Actions */}
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {i > 0 && (
                              <button
                                onClick={() => handleReorder(realIndex, realIndex - 1)}
                                title="Monter dans l'ordre"
                                className="p-1.5 rounded skeuo-btn text-text-muted hover:text-text-primary"
                              >
                                <ArrowUp size={13} />
                              </button>
                            )}
                            {i < upcomingTracks.length - 1 && (
                              <button
                                onClick={() => handleReorder(realIndex, realIndex + 1)}
                                title="Descendre dans l'ordre"
                                className="p-1.5 rounded skeuo-btn text-text-muted hover:text-text-primary"
                              >
                                <ArrowDown size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(realIndex)}
                              title="Retirer de la file"
                              className="p-1.5 rounded skeuo-btn text-text-muted hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
