import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { CustomTitlebar } from '@/components/layout/CustomTitlebar';
import { AudioEngine } from '@/components/player/AudioEngine';
import { PlaylistHomeView } from '@/components/home/PlaylistHomeView';
import { PlaylistCarouselView } from '@/components/playlist/PlaylistCarouselView';
import { SettingsView } from '@/components/settings/SettingsView';
import { hapticAudio } from '@/lib/hapticAudio';

export const App: React.FC = () => {
  const { loadLibrary } = useLibraryStore();
  const { loadPlaylists } = usePlaylistStore();
  const { loadSavedState } = usePlayerStore();

  const [activeView, setActiveView] = useState<'home' | 'carousel'>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadLibrary();
    loadPlaylists();
    loadSavedState();
  }, [loadLibrary, loadPlaylists, loadSavedState]);

  const handleOpenPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setActiveView('carousel');
  };

  const handleBackToHome = () => {
    setActiveView('home');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text-primary select-none">
      {/* Invisible Web Audio Engine */}
      <AudioEngine />

      <CustomTitlebar />

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeView === 'home' && (
            <motion.div
              key="home-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full"
            >
              <PlaylistHomeView onOpenPlaylist={handleOpenPlaylist} />
            </motion.div>
          )}

          {activeView === 'carousel' && selectedPlaylistId && (
            <motion.div
              key={`carousel-view-${selectedPlaylistId}`}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full"
            >
              <PlaylistCarouselView
                playlistId={selectedPlaylistId}
                onBack={handleBackToHome}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Discreet Settings Overlay Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="skeuo-panel rounded-card border-2 border-border/80 metal-grain shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface/50">
                  <span className="font-mono text-xs font-bold text-accent uppercase tracking-widest">
                    CONFIGURATION SYSTÈME
                  </span>
                  <button
                    onClick={() => {
                      hapticAudio.playToggleSnap();
                      setIsSettingsOpen(false);
                    }}
                    className="p-1 rounded-btn text-text-muted hover:text-text-primary skeuo-btn"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Settings Content Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6">
                  <SettingsView />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
