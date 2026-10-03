import React, { useEffect, useRef, useCallback } from 'react';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getAudioFileUrl, getCoverImageUrl, fetchStreamInfo } from '@/lib/tauri';
import { audioAnalysis } from '@/lib/audioAnalysis';

export const AudioEngine: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track the ID we last loaded so we avoid redundant src assignments
  const loadedTrackIdRef = useRef<string | null>(null);
  // Flag: should we play as soon as audio is ready?
  const pendingPlayRef = useRef<boolean>(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    volume,
    isMuted,
    playbackSpeed,
    sleepTimerActive,
    setDuration,
    setCurrentTime,
    nextTrack,
    prevTrack,
    togglePlay,
    pause,
    seek,
    setVolume,
    toggleMute,
    decrementSleepTimer,
  } = usePlayerStore();

  // play() rejects with AbortError when the source changes mid-request: harmless.
  // Any other rejection means nothing is audible, so reflect it in the UI.
  const handlePlayError = (err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.warn('[AudioEngine] Lecture refusée :', err);
    pendingPlayRef.current = false;
    pause();
  };

  // -----------------------------------------------------------------------
  // Handle track source change.
  // Depends on currentTrack?.id only, so it only fires when the track truly
  // changes — not on every isPlaying toggle.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audioAnalysis.attachAudio(audio);

    if (!currentTrack) {
      loadedTrackIdRef.current = null;
      pendingPlayRef.current = false;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    // Always reload src when the track ID changes
    if (loadedTrackIdRef.current !== currentTrack.id) {
      loadedTrackIdRef.current = currentTrack.id;
      pendingPlayRef.current = isPlaying;

      const trackId = currentTrack.id;
      const trackPath = currentTrack.filepath;

      fetchStreamInfo().then((info) => {
        if (loadedTrackIdRef.current !== trackId || !audioRef.current) return;
        const streamUrl = info
          ? `${info.base_url}/stream/${encodeURIComponent(trackId)}?token=${info.token}`
          : isTauri()
          ? convertFileSrc(trackPath)
          : getAudioFileUrl(trackPath);

        audioRef.current.src = streamUrl;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.load();
      });
      // Play will be triggered via oncanplay below
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  // -----------------------------------------------------------------------
  // Handle play / pause toggling when the track is ALREADY loaded.
  // When a track is freshly loaded, pendingPlayRef handles the first play.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // If this track is not yet loaded, just update the pending flag
    if (loadedTrackIdRef.current !== currentTrack.id) {
      pendingPlayRef.current = isPlaying;
      return;
    }

    if (isPlaying) {
      audioAnalysis.resume();
      audio.play().catch(handlePlayError);
    } else {
      audio.pause();
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Volume & mute
  // -----------------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // -----------------------------------------------------------------------
  // Playback speed
  // -----------------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // -----------------------------------------------------------------------
  // Seek — only apply when the difference is large enough (user-initiated)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - currentTime) > 1.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // -----------------------------------------------------------------------
  // Sleep timer ticker
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sleepTimerActive) return;
    const interval = setInterval(() => {
      decrementSleepTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerActive, decrementSleepTimer]);

  // -----------------------------------------------------------------------
  // MediaSession API
  // -----------------------------------------------------------------------
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      const coverUrl = getCoverImageUrl(currentTrack.cover_path);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: coverUrl
          ? [
              { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
              { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
              { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
            ]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seek(details.seekTime);
        }
      });
    }
  }, [currentTrack, nextTrack, prevTrack, togglePlay, seek]);

  // -----------------------------------------------------------------------
  // Global keyboard shortcuts
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) {
            const newTime = Math.max(0, audioRef.current.currentTime - 5);
            seek(newTime);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) {
            const maxDuration = audioRef.current.duration || 0;
            const newTime = Math.min(maxDuration, audioRef.current.currentTime + 5);
            seek(newTime);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyN':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            nextTrack();
          }
          break;
        case 'KeyP':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            prevTrack();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextTrack, prevTrack, seek, volume, setVolume, toggleMute]);

  // -----------------------------------------------------------------------
  // onCanPlay handler — triggers play after src/load completes
  // -----------------------------------------------------------------------
  const handleCanPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      audio.play().catch(handlePlayError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <audio
      ref={audioRef}
      crossOrigin="anonymous"
      onCanPlay={handleCanPlay}
      onTimeUpdate={() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }}
      onDurationChange={() => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration || 0);
        }
      }}
      onLoadedMetadata={() => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration || 0);
        }
      }}
      onEnded={() => {
        nextTrack();
      }}
      onError={() => {
        const audio = audioRef.current;
        const mediaErr = audio?.error;
        let errorName = 'UNKNOWN_MEDIA_ERROR';
        let errorDesc = 'Erreur inconnue lors du chargement ou de la lecture du flux audio.';

        if (mediaErr) {
          switch (mediaErr.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorName = 'MEDIA_ERR_ABORTED';
              errorDesc = 'Lecture interrompue par l\'utilisateur ou par l\'application.';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorName = 'MEDIA_ERR_NETWORK';
              errorDesc = 'Erreur réseau/système lors du streaming via le protocole asset.';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorName = 'MEDIA_ERR_DECODE';
              errorDesc = 'Impossible de décoder le flux audio (codec non supporté ou fichier MP3 corrompu).';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorName = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
              errorDesc = 'Format non supporté ou chemin de fichier inaccessible par la WebView.';
              break;
          }
        }

        console.error(
          `[AudioEngine] 🛑 ERREUR CRITIQUE DE LECTURE :\n` +
          `  • Code d'erreur : ${errorName} (code numérique: ${mediaErr?.code || 'N/A'})\n` +
          `  • Détail : ${errorDesc}\n` +
          `  • Message natif : ${mediaErr?.message || 'aucun'}\n` +
          `  • Piste : "${currentTrack?.title}" par "${currentTrack?.artist}"\n` +
          `  • Chemin local : ${currentTrack?.filepath}\n` +
          `  • URL convertie : ${audio?.src}`
        );

        // ARRÊT IMMÉDIAT DE LA BOUCLE D'AUTOPLAY : Ne JAMAIS appeler nextTrack() en cas d'erreur !
        pendingPlayRef.current = false;
        pause();
      }}
      preload="auto"
      className="hidden"
    />
  );
};
