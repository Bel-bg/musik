export type RepeatMode = 'off' | 'all' | 'one';

export interface WatchedFolder {
  id: string;
  path: string;
  date_added: string;
  last_scan: string | null;
  is_active: boolean;
  is_accessible?: boolean;
}

export interface Track {
  id: string;
  filepath: string;
  folder_id: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album: string;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  duration: number; // in seconds
  cover_path: string | null;
  date_added: string;
  last_played: string | null;
  play_count: number;
  is_available: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
  position: number;
  track_count: number;
}

export interface PlaylistTrackJoin {
  playlist_id: string;
  track_id: string;
  position: number;
}

export interface AppSettings {
  volume: number;
  is_muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  last_track_id: string | null;
  last_position: number;
  playback_speed: number;
  restore_last_track_on_startup: boolean;
  restore_last_view_on_startup: boolean;
  media_keys_enabled: boolean;
  database_path?: string;
  cache_path?: string;
  version?: string;
}

export type ActiveView = 'tracks' | 'playlist-detail' | 'settings';

export interface ScannedTrackMetadata {
  id: string;
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_path?: string | null;
  track_number: number | null;
  year: number | null;
}
