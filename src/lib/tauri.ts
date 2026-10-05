import { invoke, convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  Track,
  Playlist,
  WatchedFolder,
  AppSettings,
  ScannedTrackMetadata,
} from '@/types';

export const isTauriEnvironment = (): boolean => {
  try {
    return isTauri();
  } catch {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }
};

export interface StreamInfo {
  port: number;
  token: string;
  base_url: string;
}

export interface AudioCacheStats {
  total_bytes: number;
  max_bytes: number;
}

let cachedStreamInfo: StreamInfo | null = null;
let streamInfoPromise: Promise<StreamInfo | null> | null = null;

export async function fetchStreamInfo(): Promise<StreamInfo | null> {
  if (cachedStreamInfo) return cachedStreamInfo;
  if (!isTauriEnvironment()) return null;
  if (streamInfoPromise) return streamInfoPromise;

  streamInfoPromise = invoke<StreamInfo>('get_stream_info')
    .then((info) => {
      cachedStreamInfo = info;
      return info;
    })
    .catch((err) => {
      console.warn('[fetchStreamInfo] Failed to fetch stream info:', err);
      return null;
    })
    .finally(() => {
      streamInfoPromise = null;
    });

  return streamInfoPromise;
}

// Prefetch stream info immediately on startup
if (typeof window !== 'undefined') {
  fetchStreamInfo().catch(() => {});
}

export function getTrackAudioUrl(track: Track | { id: string; filepath: string } | null): string {
  if (!track) return '';
  if (cachedStreamInfo) {
    return `${cachedStreamInfo.base_url}/stream/${encodeURIComponent(track.id)}?token=${cachedStreamInfo.token}`;
  }
  return getAudioFileUrl(track.filepath);
}

// Convert a local file path to a URL that Tauri's webview can load via asset protocol.
export function getAudioFileUrl(filepath: string): string {
  if (!filepath) return '';
  if (
    filepath.startsWith('http://') ||
    filepath.startsWith('https://') ||
    filepath.startsWith('blob:') ||
    filepath.startsWith('data:') ||
    filepath.startsWith('asset:')
  ) {
    return filepath;
  }
  if (isTauriEnvironment()) {
    try {
      return convertFileSrc(filepath);
    } catch (err) {
      console.error('[getAudioFileUrl] convertFileSrc failed for path:', filepath, err);
    }
  }
  return filepath;
}

export function getCoverImageUrl(coverPath: string | null): string | null {
  if (!coverPath) return null;
  if (
    coverPath.startsWith('http://') ||
    coverPath.startsWith('https://') ||
    coverPath.startsWith('blob:') ||
    coverPath.startsWith('data:') ||
    coverPath.startsWith('asset:')
  ) {
    return coverPath;
  }
  if (isTauriEnvironment()) {
    try {
      return convertFileSrc(coverPath);
    } catch {
      // fallback
    }
  }
  return coverPath;
}

// Open a file picker restricted to common image formats and return the path.
export async function selectImageFile(): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const selected = await open({
      multiple: false,
      title: 'Choisir une image de couverture',
      filters: [
        {
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        },
      ],
    });
    if (typeof selected === 'string') return selected;
    if (Array.isArray(selected) && (selected as string[]).length > 0) {
      return (selected as string[])[0];
    }
    return null;
  } catch (err) {
    console.error('Erreur selection image:', err);
    return null;
  }
}

export const tauriApi = {
  // Folders & Library
  async selectFolder(): Promise<string | null> {
    if (isTauriEnvironment()) {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Selectionner un dossier de musique',
        });
        if (typeof selected === 'string') return selected;
        if (Array.isArray(selected) && (selected as string[]).length > 0) {
          return (selected as string[])[0];
        }
        return null;
      } catch (error) {
        console.error('Erreur lors de la selection du dossier:', error);
        return null;
      }
    }
    return null;
  },

  async getWatchedFolders(): Promise<WatchedFolder[]> {
    if (isTauriEnvironment()) {
      return await invoke<WatchedFolder[]>('get_watched_folders');
    }
    const saved = localStorage.getItem('musik_watched_folders');
    return saved ? JSON.parse(saved) : [];
  },

  async addWatchedFolder(path: string): Promise<WatchedFolder> {
    if (isTauriEnvironment()) {
      return await invoke<WatchedFolder>('add_watched_folder', { path });
    }
    const folders: WatchedFolder[] = await this.getWatchedFolders();
    const existing = folders.find((f) => f.path === path);
    if (existing) return existing;
    const newFolder: WatchedFolder = {
      id: String(Date.now()),
      path,
      date_added: new Date().toISOString(),
      last_scan: new Date().toISOString(),
      is_active: true,
      is_accessible: true,
    };
    folders.push(newFolder);
    localStorage.setItem('musik_watched_folders', JSON.stringify(folders));
    return newFolder;
  },

  async removeWatchedFolder(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('remove_watched_folder', { id });
      return;
    }
    const folders: WatchedFolder[] = await this.getWatchedFolders();
    const updated = folders.filter((f) => f.id !== id);
    localStorage.setItem('musik_watched_folders', JSON.stringify(updated));
  },

  async rescanLibrary(): Promise<{ count: number }> {
    if (isTauriEnvironment()) {
      return await invoke<{ count: number }>('rescan_library');
    }
    return { count: 0 };
  },

  // Tracks & Navigation
  async getTracks(): Promise<Track[]> {
    if (isTauriEnvironment()) {
      return await invoke<Track[]>('get_tracks');
    }
    const saved = localStorage.getItem('musik_tracks');
    return saved ? JSON.parse(saved) : [];
  },

  async searchLibrary(query: string): Promise<{
    tracks: Track[];
    playlists: Playlist[];
  }> {
    if (isTauriEnvironment()) {
      return await invoke('search_library', { query });
    }
    return { tracks: [], playlists: [] };
  },

  // Playlists
  async getPlaylists(): Promise<Playlist[]> {
    if (isTauriEnvironment()) {
      return await invoke<Playlist[]>('get_playlists');
    }
    const saved = localStorage.getItem('musik_playlists');
    return saved ? JSON.parse(saved) : [];
  },

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    if (isTauriEnvironment()) {
      return await invoke<Track[]>('get_playlist_tracks', { playlistId });
    }
    return [];
  },

  async createPlaylist(name: string, coverPath?: string | null): Promise<Playlist> {
    if (isTauriEnvironment()) {
      return await invoke<Playlist>('create_playlist', {
        name,
        coverPath: coverPath ?? null,
      });
    }
    const playlists: Playlist[] = await this.getPlaylists();
    const newPlaylist: Playlist = {
      id: String(Date.now()),
      name,
      cover_path: coverPath ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      position: playlists.length,
      track_count: 0,
    };
    playlists.push(newPlaylist);
    localStorage.setItem('musik_playlists', JSON.stringify(playlists));
    return newPlaylist;
  },

  async renamePlaylist(id: string, name: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('rename_playlist', { id, name });
      return;
    }
    const playlists: Playlist[] = await this.getPlaylists();
    const target = playlists.find((p) => p.id === id);
    if (target) {
      target.name = name;
      target.updated_at = new Date().toISOString();
      localStorage.setItem('musik_playlists', JSON.stringify(playlists));
    }
  },

  async deletePlaylist(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('delete_playlist', { id });
      return;
    }
    const playlists: Playlist[] = await this.getPlaylists();
    const updated = playlists.filter((p) => p.id !== id);
    localStorage.setItem('musik_playlists', JSON.stringify(updated));
  },

  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('add_tracks_to_playlist', { playlistId, trackIds });
      return;
    }
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('remove_track_from_playlist', { playlistId, trackId });
      return;
    }
  },

  async reorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('reorder_playlist_tracks', { playlistId, trackIds });
      return;
    }
  },

  async exportPlaylistM3u(playlistId: string, targetPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('export_playlist_m3u', { playlistId, targetPath });
      return;
    }
  },

  async importPlaylistM3u(filePath: string): Promise<Playlist> {
    if (isTauriEnvironment()) {
      return await invoke<Playlist>('import_playlist_m3u', { filePath });
    }
    throw new Error('Non supporte en mode navigateur');
  },

  async recordPlayHistory(trackId: string, durationListened: number): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('record_play_history', { trackId, durationListened });
      return;
    }
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    if (isTauriEnvironment()) {
      return await invoke<AppSettings>('get_settings');
    }
    const saved = localStorage.getItem('musik_settings');
    if (saved) return JSON.parse(saved);
    return {
      volume: 0.8,
      is_muted: false,
      shuffle: false,
      repeat: 'off',
      last_track_id: null,
      last_position: 0,
      playback_speed: 1.0,
      restore_last_track_on_startup: true,
      restore_last_view_on_startup: true,
      media_keys_enabled: true,
      version: '1.0.1',
    };
  },

  async saveSetting(key: string, value: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('save_setting', { key, value });
      return;
    }
    const current = await this.getSettings();
    (current as unknown as Record<string, unknown>)[key] = value;
    localStorage.setItem('musik_settings', JSON.stringify(current));
  },

  // Parallelized fast metadata scan without picture bytes (500+ tracks < 50ms)
  async scanMusicFolder(folderPath: string): Promise<ScannedTrackMetadata[]> {
    if (isTauriEnvironment()) {
      return await invoke<ScannedTrackMetadata[]>('scan_music_folder', { folderPath });
    }
    return [];
  },

  // On-demand single cover extraction (returns data:image/...;base64,... or null)
  async extractMp3Cover(filePath: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      return await invoke<string | null>('extract_mp3_cover', { filePath });
    }
    return null;
  },

  async getStreamInfo(): Promise<StreamInfo | null> {
    return await fetchStreamInfo();
  },

  async getAudioCacheStats(): Promise<AudioCacheStats | null> {
    if (isTauriEnvironment()) {
      return await invoke<AudioCacheStats>('get_audio_cache_stats');
    }
    return null;
  },

  async openExternalUrl(url: string): Promise<void> {
    return openExternalUrl(url);
  },
};

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke('open_external_url', { url });
      return;
    } catch (err) {
      console.warn('[openExternalUrl] invoke failed, fallback window.open:', err);
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

