import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListPlus, Play, Plus, Trash2 } from 'lucide-react';
import type { Track } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { hapticAudio } from '@/lib/hapticAudio';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  track: Track;
  currentPlaylistId?: string | null;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  track,
  currentPlaylistId,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { playTrack, addToNext, addToQueue } = usePlayerStore();
  const { playlists, addTracksToPlaylist, removeTrackFromPlaylist } = usePlaylistStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Ensure menu stays within viewport
  const menuX = Math.min(position.x, window.innerWidth - 240);
  const menuY = Math.min(position.y, window.innerHeight - 320);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{ top: `${menuY}px`, left: `${menuX}px` }}
        className="fixed z-50 w-56 skeuo-panel rounded-lg shadow-2xl py-1 text-xs select-none border border-border metal-grain"
      >
        <button
          onClick={() => {
            hapticAudio.playHeavySwitch();
            playTrack(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-text-primary hover:bg-surface-secondary/80 transition-colors font-medium"
        >
          <Play size={13} className="text-accent" />
          <span>Lire maintenant</span>
        </button>

        <button
          onClick={() => {
            hapticAudio.playToggleSnap();
            addToNext(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-text-primary hover:bg-surface-secondary/80 transition-colors font-medium"
        >
          <ListPlus size={13} className="text-text-muted" />
          <span>Lire ensuite</span>
        </button>

        <button
          onClick={() => {
            hapticAudio.playToggleSnap();
            addToQueue(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-text-primary hover:bg-surface-secondary/80 transition-colors font-medium"
        >
          <Plus size={13} className="text-text-muted" />
          <span>Ajouter à la file</span>
        </button>

        {playlists.length > 0 && (
          <div className="border-t border-[#202430] my-1 pt-1">
            <div className="px-3.5 py-1 text-[9px] uppercase tracking-widest text-text-muted font-bold font-mono">
              Ajouter à la bande
            </div>
            <div className="max-h-36 overflow-y-auto px-1">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => {
                    hapticAudio.playToggleSnap();
                    addTracksToPlaylist(pl.id, [track.id]);
                    onClose();
                  }}
                  className="w-full truncate px-2.5 py-1.5 rounded text-left text-text-muted hover:text-accent hover:bg-surface-secondary/80 transition-colors text-xs font-medium"
                >
                  {pl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentPlaylistId && (
          <div className="border-t border-[#202430] my-1 pt-1">
            <button
              onClick={() => {
                hapticAudio.playHeavySwitch();
                removeTrackFromPlaylist(currentPlaylistId, track.id);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium"
            >
              <Trash2 size={13} />
              <span>Retirer de la bande</span>
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
