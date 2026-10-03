import { create } from 'zustand';
import type { Track, RepeatMode } from '@/types';
import { tauriApi } from '@/lib/tauri';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  shuffle: boolean;
  repeat: RepeatMode;
  sleepTimer: number | null; // remaining seconds
  sleepTimerActive: boolean;

  // Actions
  setTrack: (track: Track) => void;
  playTrack: (track: Track, newQueue?: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  setRepeat: (repeat: RepeatMode) => void;
  toggleRepeat: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  decrementSleepTimer: () => void;
  addToNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  loadSavedState: () => Promise<void>;
}

// Smart shuffle helper
function generateShuffledOrder<T extends { id: string }>(items: T[], currentItem: T | null): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (currentItem) {
    const index = result.findIndex((t) => t.id === currentItem.id);
    if (index > 0) {
      result.splice(index, 1);
      result.unshift(currentItem);
    }
  }
  return result;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  queueIndex: -1,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 0.8,
  isMuted: false,
  playbackSpeed: 1.0,
  shuffle: false,
  repeat: 'off',
  sleepTimer: null,
  sleepTimerActive: false,

  setTrack: (track: Track) => {
    set({ currentTrack: track, currentTime: 0 });
    tauriApi.saveSetting('last_track_id', track.id);
  },

  playTrack: (track: Track, newQueue?: Track[], startIndex?: number) => {
    const state = get();
    let queue = newQueue ? [...newQueue] : state.queue;
    if (queue.length === 0 || (newQueue && newQueue.length > 0)) {
      queue = newQueue || [track];
    }

    let originalQueue = state.originalQueue;
    if (newQueue) {
      originalQueue = [...newQueue];
    }

    let targetIndex = startIndex !== undefined ? startIndex : queue.findIndex((t) => t.id === track.id);
    if (targetIndex === -1) {
      queue = [track, ...queue];
      targetIndex = 0;
    }

    if (state.shuffle && newQueue) {
      queue = generateShuffledOrder(newQueue, track);
      targetIndex = 0;
    }

    set({
      currentTrack: track,
      queue,
      originalQueue,
      queueIndex: targetIndex,
      isPlaying: true,
      currentTime: 0,
    });

    tauriApi.saveSetting('last_track_id', track.id);
    tauriApi.saveSetting('last_position', '0');
  },

  togglePlay: () => {
    const { isPlaying, currentTrack, queue } = get();
    if (!currentTrack && queue.length > 0) {
      get().playTrack(queue[0]);
      return;
    }
    set({ isPlaying: !isPlaying });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  nextTrack: () => {
    const { queue, queueIndex, repeat, currentTrack, currentTime } = get();
    if (currentTrack && currentTime > 10) {
      tauriApi.recordPlayHistory(currentTrack.id, Math.floor(currentTime));
    }

    if (queue.length === 0) return;

    if (repeat === 'one' && currentTrack) {
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      const nextSong = queue[nextIndex];
      set({
        currentTrack: nextSong,
        queueIndex: nextIndex,
        currentTime: 0,
        isPlaying: true,
      });
      tauriApi.saveSetting('last_track_id', nextSong.id);
    } else if (repeat === 'all' && queue.length > 0) {
      const firstSong = queue[0];
      set({
        currentTrack: firstSong,
        queueIndex: 0,
        currentTime: 0,
        isPlaying: true,
      });
      tauriApi.saveSetting('last_track_id', firstSong.id);
    } else {
      set({ isPlaying: false });
    }
  },

  prevTrack: () => {
    const { currentTime, queue, queueIndex, repeat } = get();
    // Rule: if played more than 3 seconds, seek back to start
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    if (queue.length === 0) return;

    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      const prevSong = queue[prevIndex];
      set({
        currentTrack: prevSong,
        queueIndex: prevIndex,
        currentTime: 0,
        isPlaying: true,
      });
      tauriApi.saveSetting('last_track_id', prevSong.id);
    } else if (repeat === 'all' && queue.length > 0) {
      const lastIndex = queue.length - 1;
      const lastSong = queue[lastIndex];
      set({
        currentTrack: lastSong,
        queueIndex: lastIndex,
        currentTime: 0,
        isPlaying: true,
      });
      tauriApi.saveSetting('last_track_id', lastSong.id);
    } else {
      set({ currentTime: 0 });
    }
  },

  seek: (time: number) => {
    set({ currentTime: time });
    tauriApi.saveSetting('last_position', String(Math.floor(time)));
  },

  setDuration: (duration: number) => set({ duration }),
  setCurrentTime: (time: number) => set({ currentTime: time }),

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
    tauriApi.saveSetting('volume', String(clamped));
  },

  toggleMute: () => {
    const { isMuted, volume } = get();
    if (isMuted) {
      set({ isMuted: false, volume: volume === 0 ? 0.8 : volume });
    } else {
      set({ isMuted: true });
    }
  },

  toggleShuffle: () => {
    const { shuffle, queue, originalQueue, currentTrack } = get();
    const newShuffle = !shuffle;

    if (newShuffle) {
      const baseQueue = originalQueue.length > 0 ? originalQueue : queue;
      const shuffled = generateShuffledOrder(baseQueue, currentTrack);
      const newIndex = currentTrack ? shuffled.findIndex((t) => t.id === currentTrack.id) : 0;
      set({
        shuffle: true,
        queue: shuffled,
        originalQueue: baseQueue,
        queueIndex: newIndex >= 0 ? newIndex : 0,
      });
    } else {
      const restored = originalQueue.length > 0 ? [...originalQueue] : [...queue];
      const newIndex = currentTrack ? restored.findIndex((t) => t.id === currentTrack.id) : 0;
      set({
        shuffle: false,
        queue: restored,
        queueIndex: newIndex >= 0 ? newIndex : 0,
      });
    }
    tauriApi.saveSetting('shuffle', String(newShuffle));
  },

  setRepeat: (repeat: RepeatMode) => {
    set({ repeat });
    tauriApi.saveSetting('repeat', repeat);
  },

  toggleRepeat: () => {
    const { repeat } = get();
    const nextRepeat: RepeatMode = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    set({ repeat: nextRepeat });
    tauriApi.saveSetting('repeat', nextRepeat);
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
    tauriApi.saveSetting('playback_speed', String(speed));
  },

  setSleepTimer: (minutes: number | null) => {
    if (minutes === null) {
      set({ sleepTimer: null, sleepTimerActive: false });
    } else {
      set({ sleepTimer: minutes * 60, sleepTimerActive: true });
    }
  },

  decrementSleepTimer: () => {
    const { sleepTimer, sleepTimerActive } = get();
    if (!sleepTimerActive || sleepTimer === null) return;
    if (sleepTimer <= 1) {
      set({ sleepTimer: null, sleepTimerActive: false, isPlaying: false });
    } else {
      set({ sleepTimer: sleepTimer - 1 });
    }
  },

  addToNext: (track: Track) => {
    const { queue, queueIndex } = get();
    const newQueue = [...queue];
    const insertIndex = queueIndex >= 0 ? queueIndex + 1 : 0;
    newQueue.splice(insertIndex, 0, track);
    set({ queue: newQueue });
  },

  addToQueue: (track: Track) => {
    const { queue } = get();
    set({ queue: [...queue, track] });
  },

  removeFromQueue: (index: number) => {
    const { queue, queueIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const newQueue = queue.filter((_, i) => i !== index);
    let newQueueIndex = queueIndex;
    if (index < queueIndex) {
      newQueueIndex = queueIndex - 1;
    } else if (index === queueIndex) {
      newQueueIndex = Math.min(queueIndex, newQueue.length - 1);
    }
    set({ queue: newQueue, queueIndex: newQueueIndex });
  },

  reorderQueue: (startIndex: number, endIndex: number) => {
    const { queue, queueIndex } = get();
    const result = Array.from(queue);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    let newQueueIndex = queueIndex;
    if (queueIndex === startIndex) {
      newQueueIndex = endIndex;
    } else if (startIndex < queueIndex && endIndex >= queueIndex) {
      newQueueIndex = queueIndex - 1;
    } else if (startIndex > queueIndex && endIndex <= queueIndex) {
      newQueueIndex = queueIndex + 1;
    }

    set({ queue: result, queueIndex: newQueueIndex });
  },

  clearQueue: () => {
    const { currentTrack } = get();
    set({
      queue: currentTrack ? [currentTrack] : [],
      queueIndex: currentTrack ? 0 : -1,
    });
  },

  loadSavedState: async () => {
    try {
      const settings = await tauriApi.getSettings();
      set({
        volume: settings.volume ?? 0.8,
        isMuted: settings.is_muted ?? false,
        shuffle: settings.shuffle ?? false,
        repeat: (settings.repeat as RepeatMode) ?? 'off',
        playbackSpeed: settings.playback_speed ?? 1.0,
      });

      if (settings.restore_last_track_on_startup && settings.last_track_id) {
        const tracks = await tauriApi.getTracks();
        const found = tracks.find((t) => t.id === settings.last_track_id);
        if (found) {
          set({
            currentTrack: found,
            currentTime: settings.last_position || 0,
            isPlaying: false,
          });
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement des parametres:', err);
    }
  },
}));
