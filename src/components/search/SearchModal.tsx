import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Music, ListPlus } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { CoverArt } from '@/components/common/CoverArt';
import { hapticAudio } from '@/lib/hapticAudio';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { tracks, openPlaylist } = useLibraryStore();
  const { playlists } = usePlaylistStore();
  const { playTrack } = usePlayerStore();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          hapticAudio.playToggleSnap();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cleanQuery = query.toLowerCase().trim();

  const filteredTracks = cleanQuery
    ? tracks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(cleanQuery) ||
            t.artist.toLowerCase().includes(cleanQuery) ||
            t.album.toLowerCase().includes(cleanQuery)
        )
        .slice(0, 8)
    : [];

  const filteredPlaylists = cleanQuery
    ? playlists.filter((p) => p.name.toLowerCase().includes(cleanQuery)).slice(0, 4)
    : [];

  const hasResults = filteredTracks.length > 0 || filteredPlaylists.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              hapticAudio.playToggleSnap();
              onClose();
            }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl skeuo-panel rounded-card shadow-2xl overflow-hidden z-10 flex flex-col max-h-[75vh] metal-grain border border-border"
          >
            {/* Search Input Bar in Recessed Groove */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#202430] bg-surface-cavity/70">
              <Search size={18} className="text-accent" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher par titre, artiste ou nom de bande..."
                className="flex-1 bg-transparent text-text-primary text-sm placeholder-text-muted focus:outline-none font-medium"
              />
              {query && (
                <button
                  onClick={() => {
                    hapticAudio.playToggleSnap();
                    setQuery('');
                  }}
                  aria-label="Effacer le texte"
                  className="p-1 rounded skeuo-btn text-text-muted hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results Container */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 z-10">
              {!cleanQuery ? (
                <div className="py-12 text-center text-text-subtle text-xs font-mono uppercase tracking-wider">
                  Saisissez un mot-clé pour sonder la bibliothèque locale.
                </div>
              ) : !hasResults ? (
                <div className="py-12 text-center text-text-muted text-xs font-mono uppercase tracking-wider">
                  Aucun résultat détecté pour "{query}".
                </div>
              ) : (
                <>
                  {/* Tracks Result */}
                  {filteredTracks.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[10px] font-bold font-mono text-accent uppercase tracking-widest px-2">
                        <Music size={12} />
                        <span>Pistes identifiées</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {filteredTracks.map((track) => (
                          <button
                            key={track.id}
                            onClick={() => {
                              hapticAudio.playHeavySwitch();
                              playTrack(track);
                              onClose();
                            }}
                            className="flex items-center gap-3 p-2 rounded-lg skeuo-recessed hover:border-accent/40 text-left transition-all border border-transparent"
                          >
                            <CoverArt
                              coverPath={track.cover_path}
                              title={track.title}
                              artist={track.artist}
                              size="sm"
                              className="w-9 h-9 rounded object-cover"
                            />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold text-text-primary truncate">
                                {track.title}
                              </span>
                              <span className="text-[11px] text-text-muted truncate font-medium">
                                {track.artist} • {track.album}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playlists Result */}
                  {filteredPlaylists.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[10px] font-bold font-mono text-accent uppercase tracking-widest px-2">
                        <ListPlus size={12} />
                        <span>Bandes & Playlists</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {filteredPlaylists.map((playlist) => (
                          <button
                            key={playlist.id}
                            onClick={() => {
                              hapticAudio.playToggleSnap();
                              openPlaylist(playlist.id);
                              onClose();
                            }}
                            className="flex items-center gap-2.5 p-2.5 rounded-lg skeuo-recessed hover:border-accent/40 text-left transition-all border border-transparent"
                          >
                            <div className="w-8 h-8 rounded skeuo-btn flex items-center justify-center text-accent">
                              <ListPlus size={14} />
                            </div>
                            <span className="text-xs font-bold text-text-primary truncate">
                              {playlist.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
