import { create } from 'zustand';
import type { Track, WatchedFolder, ActiveView } from '@/types';
import { tauriApi } from '@/lib/tauri';

export type SortField = 'title' | 'artist' | 'album' | 'date_added' | 'duration' | 'play_count';
export type SortOrder = 'asc' | 'desc';

interface LibraryState {
  tracks: Track[];
  watchedFolders: WatchedFolder[];

  // Navigation
  currentView: ActiveView;
  selectedPlaylistId: string | null;

  // Search & Filter
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;

  // Scan state
  isScanning: boolean;
  scanMessage: string | null;

  // Actions
  loadLibrary: () => Promise<void>;
  setCurrentView: (view: ActiveView) => void;
  openPlaylist: (playlistId: string) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (field: SortField, order?: SortOrder) => void;
  addWatchedFolder: () => Promise<void>;
  addWatchedFolderPath: (path: string) => Promise<void>;
  removeWatchedFolder: (id: string) => Promise<void>;
  rescan: () => Promise<void>;
  getFilteredAndSortedTracks: () => Track[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  watchedFolders: [],

  currentView: 'tracks',
  selectedPlaylistId: null,

  searchQuery: '',
  sortField: 'title',
  sortOrder: 'asc',

  isScanning: false,
  scanMessage: null,

  loadLibrary: async () => {
    try {
      const [tracks, watchedFolders] = await Promise.all([
        tauriApi.getTracks(),
        tauriApi.getWatchedFolders(),
      ]);

      set({
        tracks,
        watchedFolders,
      });
    } catch (error) {
      console.error('Erreur lors du chargement de la bibliotheque:', error);
    }
  },

  setCurrentView: (view: ActiveView) => {
    set({ currentView: view });
  },

  openPlaylist: (playlistId: string) => {
    set({ selectedPlaylistId: playlistId, currentView: 'playlist-detail' });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSorting: (field: SortField, order?: SortOrder) => {
    const { sortField, sortOrder } = get();
    if (field === sortField && !order) {
      set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortField: field, sortOrder: order || 'asc' });
    }
  },

  addWatchedFolder: async () => {
    const selected = await tauriApi.selectFolder();
    if (selected) {
      set({ isScanning: true, scanMessage: 'Scan du dossier en cours...' });
      try {
        await tauriApi.addWatchedFolder(selected);
        await tauriApi.rescanLibrary();
        await get().loadLibrary();
      } finally {
        set({ isScanning: false, scanMessage: null });
      }
    }
  },

  addWatchedFolderPath: async (path: string) => {
    set({ isScanning: true, scanMessage: 'Scan du dossier en cours...' });
    try {
      await tauriApi.addWatchedFolder(path);
      await tauriApi.rescanLibrary();
      await get().loadLibrary();
    } finally {
      set({ isScanning: false, scanMessage: null });
    }
  },

  removeWatchedFolder: async (id: string) => {
    await tauriApi.removeWatchedFolder(id);
    await get().loadLibrary();
  },

  rescan: async () => {
    set({ isScanning: true, scanMessage: 'Mise a jour de la bibliotheque...' });
    try {
      await tauriApi.rescanLibrary();
      await get().loadLibrary();
    } finally {
      set({ isScanning: false, scanMessage: null });
    }
  },

  getFilteredAndSortedTracks: () => {
    const { tracks, searchQuery, sortField, sortOrder } = get();
    let result = [...tracks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          (t.genre && t.genre.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'artist':
          comparison = a.artist.localeCompare(b.artist);
          break;
        case 'album':
          comparison = a.album.localeCompare(b.album);
          break;
        case 'date_added':
          comparison = new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'play_count':
          comparison = (a.play_count || 0) - (b.play_count || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  },
}));
