import { create } from 'zustand';
import type { Playlist, Track } from '@/types';
import { tauriApi } from '@/lib/tauri';

interface PlaylistState {
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  activePlaylistTracks: Track[];
  isLoading: boolean;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string, coverPath?: string | null) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  loadPlaylistDetail: (id: string) => Promise<void>;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderTracks: (playlistId: string, trackIds: string[]) => Promise<void>;
  exportM3u: (playlistId: string, destinationPath: string) => Promise<void>;
  importM3u: (filePath: string) => Promise<Playlist | null>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  activePlaylist: null,
  activePlaylistTracks: [],
  isLoading: false,

  loadPlaylists: async () => {
    try {
      const playlists = await tauriApi.getPlaylists();
      set({ playlists });
    } catch (error) {
      console.error('Erreur chargement des playlists:', error);
    }
  },

  createPlaylist: async (name: string, coverPath?: string | null) => {
    const playlist = await tauriApi.createPlaylist(name, coverPath);
    await get().loadPlaylists();
    return playlist;
  },

  renamePlaylist: async (id: string, name: string) => {
    await tauriApi.renamePlaylist(id, name);
    await get().loadPlaylists();
    const current = get().activePlaylist;
    if (current && current.id === id) {
      set({ activePlaylist: { ...current, name } });
    }
  },

  deletePlaylist: async (id: string) => {
    await tauriApi.deletePlaylist(id);
    await get().loadPlaylists();
    const current = get().activePlaylist;
    if (current && current.id === id) {
      set({ activePlaylist: null, activePlaylistTracks: [] });
    }
  },

  loadPlaylistDetail: async (id: string) => {
    set({ isLoading: true });
    try {
      const tracks = await tauriApi.getPlaylistTracks(id);
      const playlist = get().playlists.find((p) => p.id === id) || null;
      set({ activePlaylist: playlist, activePlaylistTracks: tracks, isLoading: false });
    } catch (error) {
      console.error('Erreur chargement details playlist:', error);
      set({ isLoading: false });
    }
  },

  addTracksToPlaylist: async (playlistId: string, trackIds: string[]) => {
    await tauriApi.addTracksToPlaylist(playlistId, trackIds);
    await get().loadPlaylists();
    if (get().activePlaylist?.id === playlistId) {
      await get().loadPlaylistDetail(playlistId);
    }
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    await tauriApi.removeTrackFromPlaylist(playlistId, trackId);
    await get().loadPlaylists();
    if (get().activePlaylist?.id === playlistId) {
      await get().loadPlaylistDetail(playlistId);
    }
  },

  reorderTracks: async (playlistId: string, trackIds: string[]) => {
    await tauriApi.reorderPlaylistTracks(playlistId, trackIds);
    if (get().activePlaylist?.id === playlistId) {
      await get().loadPlaylistDetail(playlistId);
    }
  },

  exportM3u: async (playlistId: string, destinationPath: string) => {
    await tauriApi.exportPlaylistM3u(playlistId, destinationPath);
  },

  importM3u: async (filePath: string) => {
    try {
      const playlist = await tauriApi.importPlaylistM3u(filePath);
      await get().loadPlaylists();
      return playlist;
    } catch (error) {
      console.error('Erreur import m3u:', error);
      return null;
    }
  },
}));
