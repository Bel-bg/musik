import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { CustomTitlebar } from '@/components/layout/CustomTitlebar';
import { AudioEngine } from '@/components/player/AudioEngine';
import { PlaylistHomeView } from '@/components/home/PlaylistHomeView';
import { PlaylistCarouselView } from '@/components/playlist/PlaylistCarouselView';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { startMiniPlayerBridge } from '@/lib/miniPlayer';

export const App: React.FC = () => {
  const { loadLibrary } = useLibraryStore();
  const { loadPlaylists } = usePlaylistStore();
  const { loadSavedState } = usePlayerStore();

  const [activeView, setActiveView] = useState<'home' | 'carousel'>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  useEffect(() => {
    Promise.allSettled([
      loadLibrary(),
      loadPlaylists(),
      loadSavedState(),
    ]).then(() => {
      setIsDataLoaded(true);
    });
  }, [loadLibrary, loadPlaylists, loadSavedState]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Relais audio/état vers la fenêtre miniature
  useEffect(() => startMiniPlayerBridge(), []);

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
      </div>

      {/* Audiophile Skeuomorphic Splash Screen */}
      {showSplash && (
        <SplashScreen
          onComplete={handleSplashComplete}
          isDataLoaded={isDataLoaded}
        />
      )}
    </div>
  );
};
