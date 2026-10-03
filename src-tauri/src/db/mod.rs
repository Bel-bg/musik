use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchedFolder {
    pub id: String,
    pub path: String,
    pub date_added: String,
    pub last_scan: Option<String>,
    pub is_active: bool,
    pub is_accessible: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Track {
    pub id: String,
    pub filepath: String,
    pub folder_id: String,
    pub title: String,
    pub artist: String,
    pub album_artist: Option<String>,
    pub album: String,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub track_number: Option<i32>,
    pub duration: f64,
    pub cover_path: Option<String>,
    pub date_added: String,
    pub last_played: Option<String>,
    pub play_count: i32,
    pub is_available: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub cover_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub position: i32,
    pub track_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlayHistoryItem {
    pub id: String,
    pub track_id: String,
    pub played_at: String,
    pub duration_listened: f64,
    pub track: Option<Track>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopTrackStat {
    pub track: Track,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopArtistStat {
    pub artist: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListeningStats {
    pub total_listen_time_seconds_week: f64,
    pub total_listen_time_seconds_month: f64,
    pub top_tracks: Vec<TopTrackStat>,
    pub top_artists: Vec<TopArtistStat>,
    pub total_tracks_played: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub volume: f64,
    pub is_muted: bool,
    pub shuffle: bool,
    pub repeat: String,
    pub last_track_id: Option<String>,
    pub last_position: f64,
    pub playback_speed: f64,
    pub restore_last_track_on_startup: bool,
    pub restore_last_view_on_startup: bool,
    pub media_keys_enabled: bool,
    pub database_path: Option<String>,
    pub cache_path: Option<String>,
    pub version: Option<String>,
}

pub struct Database {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

impl Database {
    pub fn init(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(&db_path)?;

        // Execute table migrations
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS watched_folders (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                date_added TEXT NOT NULL,
                last_scan TEXT,
                is_active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                filepath TEXT NOT NULL UNIQUE,
                folder_id TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album_artist TEXT,
                album TEXT NOT NULL,
                year INTEGER,
                genre TEXT,
                track_number INTEGER,
                duration REAL NOT NULL DEFAULT 0.0,
                cover_path TEXT,
                date_added TEXT NOT NULL,
                last_played TEXT,
                play_count INTEGER NOT NULL DEFAULT 0,
                is_available INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (folder_id) REFERENCES watched_folders(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                cover_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (playlist_id, track_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS play_history (
                id TEXT PRIMARY KEY,
                track_id TEXT NOT NULL,
                played_at TEXT NOT NULL,
                duration_listened REAL NOT NULL,
                FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS playlist_cached_tracks (
                playlist_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                cached_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                cached_at TEXT NOT NULL,
                PRIMARY KEY (playlist_id, track_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
            );
            ",
        )?;

        // Migration: add cover_path to playlists for existing databases.
        // SQLite has no IF NOT EXISTS on ALTER TABLE; ignoring the error is the standard approach.
        let _ = conn.execute("ALTER TABLE playlists ADD COLUMN cover_path TEXT", []);

        Ok(Database {
            conn: Mutex::new(conn),
            db_path,
        })
    }

    // Watched Folders
    pub fn get_watched_folders(&self) -> Result<Vec<WatchedFolder>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, path, date_added, last_scan, is_active FROM watched_folders ORDER BY date_added ASC")?;
        let rows = stmt.query_map([], |row| {
            let path_str: String = row.get(1)?;
            let is_accessible = std::path::Path::new(&path_str).exists();
            let is_active_int: i32 = row.get(4)?;

            Ok(WatchedFolder {
                id: row.get(0)?,
                path: path_str,
                date_added: row.get(2)?,
                last_scan: row.get(3)?,
                is_active: is_active_int == 1,
                is_accessible: Some(is_accessible),
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn add_watched_folder(&self, folder: &WatchedFolder) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO watched_folders (id, path, date_added, last_scan, is_active) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                folder.id,
                folder.path,
                folder.date_added,
                folder.last_scan,
                if folder.is_active { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn remove_watched_folder(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM watched_folders WHERE id = ?1", params![id])?;
        conn.execute("DELETE FROM tracks WHERE folder_id = ?1", params![id])?;
        Ok(())
    }

    // Tracks
    pub fn get_tracks(&self) -> Result<Vec<Track>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, filepath, folder_id, title, artist, album_artist, album, year, genre, track_number, duration, cover_path, date_added, last_played, play_count, is_available FROM tracks ORDER BY title ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            let is_available_int: i32 = row.get(15)?;
            Ok(Track {
                id: row.get(0)?,
                filepath: row.get(1)?,
                folder_id: row.get(2)?,
                title: row.get(3)?,
                artist: row.get(4)?,
                album_artist: row.get(5)?,
                album: row.get(6)?,
                year: row.get(7)?,
                genre: row.get(8)?,
                track_number: row.get(9)?,
                duration: row.get(10)?,
                cover_path: row.get(11)?,
                date_added: row.get(12)?,
                last_played: row.get(13)?,
                play_count: row.get(14)?,
                is_available: is_available_int == 1,
            })
        })?;

        let mut tracks = Vec::new();
        for r in rows {
            tracks.push(r?);
        }
        Ok(tracks)
    }

    pub fn get_track_by_id(&self, id: &str) -> Result<Option<Track>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, filepath, folder_id, title, artist, album_artist, album, year, genre, track_number, duration, cover_path, date_added, last_played, play_count, is_available FROM tracks WHERE id = ?1"
        )?;

        let mut rows = stmt.query_map([id], |row| {
            let is_available_int: i32 = row.get(15)?;
            Ok(Track {
                id: row.get(0)?,
                filepath: row.get(1)?,
                folder_id: row.get(2)?,
                title: row.get(3)?,
                artist: row.get(4)?,
                album_artist: row.get(5)?,
                album: row.get(6)?,
                year: row.get(7)?,
                genre: row.get(8)?,
                track_number: row.get(9)?,
                duration: row.get(10)?,
                cover_path: row.get(11)?,
                date_added: row.get(12)?,
                last_played: row.get(13)?,
                play_count: row.get(14)?,
                is_available: is_available_int == 1,
            })
        })?;

        if let Some(r) = rows.next() {
            Ok(Some(r?))
        } else {
            Ok(None)
        }
    }

    pub fn insert_or_update_track(&self, track: &Track) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tracks (id, filepath, folder_id, title, artist, album_artist, album, year, genre, track_number, duration, cover_path, date_added, last_played, play_count, is_available)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
             ON CONFLICT(filepath) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album_artist = excluded.album_artist,
                album = excluded.album,
                year = excluded.year,
                genre = excluded.genre,
                track_number = excluded.track_number,
                duration = excluded.duration,
                cover_path = COALESCE(excluded.cover_path, tracks.cover_path),
                is_available = excluded.is_available
            ",
            params![
                track.id,
                track.filepath,
                track.folder_id,
                track.title,
                track.artist,
                track.album_artist,
                track.album,
                track.year,
                track.genre,
                track.track_number,
                track.duration,
                track.cover_path,
                track.date_added,
                track.last_played,
                track.play_count,
                if track.is_available { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    // Playlists
    pub fn get_playlists(&self) -> Result<Vec<Playlist>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.name, p.cover_path, p.created_at, p.updated_at, p.position,
                    COUNT(pt.track_id) as track_count
             FROM playlists p
             LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
             GROUP BY p.id
             ORDER BY p.position ASC, p.created_at ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                cover_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                position: row.get(5)?,
                track_count: row.get(6)?,
            })
        })?;

        let mut playlists = Vec::new();
        for r in rows {
            playlists.push(r?);
        }
        Ok(playlists)
    }

    pub fn create_playlist(&self, id: &str, name: &str, cover_path: Option<&str>, now: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO playlists (id, name, cover_path, created_at, updated_at, position) VALUES (?1, ?2, ?3, ?4, ?5, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlists))",
            params![id, name, cover_path, now, now],
        )?;
        Ok(())
    }

    pub fn rename_playlist(&self, id: &str, name: &str, now: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE playlists SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id],
        )?;
        Ok(())
    }

    pub fn delete_playlist(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_playlist_tracks(&self, playlist_id: &str) -> Result<Vec<Track>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.filepath, t.folder_id, t.title, t.artist, t.album_artist, t.album, t.year, t.genre, t.track_number, t.duration, t.cover_path, t.date_added, t.last_played, t.play_count, t.is_available
             FROM tracks t
             JOIN playlist_tracks pt ON t.id = pt.track_id
             WHERE pt.playlist_id = ?1
             ORDER BY pt.position ASC"
        )?;

        let rows = stmt.query_map(params![playlist_id], |row| {
            let is_available_int: i32 = row.get(15)?;
            Ok(Track {
                id: row.get(0)?,
                filepath: row.get(1)?,
                folder_id: row.get(2)?,
                title: row.get(3)?,
                artist: row.get(4)?,
                album_artist: row.get(5)?,
                album: row.get(6)?,
                year: row.get(7)?,
                genre: row.get(8)?,
                track_number: row.get(9)?,
                duration: row.get(10)?,
                cover_path: row.get(11)?,
                date_added: row.get(12)?,
                last_played: row.get(13)?,
                play_count: row.get(14)?,
                is_available: is_available_int == 1,
            })
        })?;

        let mut tracks = Vec::new();
        for r in rows {
            tracks.push(r?);
        }
        Ok(tracks)
    }

    pub fn add_tracks_to_playlist(&self, playlist_id: &str, track_ids: &[String]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let max_pos: i32 = conn.query_row(
            "SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?1",
            params![playlist_id],
            |r| r.get(0),
        ).unwrap_or(0);

        for (idx, track_id) in track_ids.iter().enumerate() {
            let position = max_pos + (idx as i32) + 1;
            let _ = conn.execute(
                "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
                params![playlist_id, track_id, position],
            );
        }
        Ok(())
    }

    pub fn remove_track_from_playlist(&self, playlist_id: &str, track_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
        )?;
        Ok(())
    }

    pub fn reorder_playlist_tracks(&self, playlist_id: &str, track_ids: &[String]) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        for (idx, track_id) in track_ids.iter().enumerate() {
            tx.execute(
                "UPDATE playlist_tracks SET position = ?1 WHERE playlist_id = ?2 AND track_id = ?3",
                params![idx as i32, playlist_id, track_id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    // Audio Cache for Playlists
    pub fn get_cached_track_path(&self, track_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT cached_path FROM playlist_cached_tracks WHERE track_id = ?1 LIMIT 1"
        )?;
        let mut rows = stmt.query_map([track_id], |row| row.get(0))?;
        if let Some(r) = rows.next() {
            Ok(Some(r?))
        } else {
            Ok(None)
        }
    }

    pub fn get_total_cache_size(&self) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT COALESCE(SUM(file_size), 0) FROM (SELECT DISTINCT cached_path, file_size FROM playlist_cached_tracks)"
        )?;
        let size: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(size as u64)
    }

    pub fn add_playlist_cached_track(
        &self,
        playlist_id: &str,
        track_id: &str,
        cached_path: &str,
        file_size: u64,
        now: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO playlist_cached_tracks (playlist_id, track_id, cached_path, file_size, cached_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![playlist_id, track_id, cached_path, file_size as i64, now],
        )?;
        Ok(())
    }

    pub fn remove_playlist_cached_track(&self, playlist_id: &str, track_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let cached_path: Option<String> = conn
            .query_row(
                "SELECT cached_path FROM playlist_cached_tracks WHERE playlist_id = ?1 AND track_id = ?2",
                params![playlist_id, track_id],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(path) = cached_path {
            conn.execute(
                "DELETE FROM playlist_cached_tracks WHERE playlist_id = ?1 AND track_id = ?2",
                params![playlist_id, track_id],
            )?;

            // Check if any other playlist references this same cached file
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM playlist_cached_tracks WHERE cached_path = ?1",
                params![&path],
                |row| row.get(0),
            )?;

            if count == 0 {
                return Ok(Some(path));
            }
        }
        Ok(None)
    }

    pub fn remove_playlist_all_cached_tracks(&self, playlist_id: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT cached_path FROM playlist_cached_tracks WHERE playlist_id = ?1"
        )?;
        let paths: Vec<String> = stmt
            .query_map([playlist_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        conn.execute(
            "DELETE FROM playlist_cached_tracks WHERE playlist_id = ?1",
            params![playlist_id],
        )?;

        let mut to_delete = Vec::new();
        for path in paths {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM playlist_cached_tracks WHERE cached_path = ?1",
                params![&path],
                |row| row.get(0),
            )?;
            if count == 0 {
                to_delete.push(path);
            }
        }
        Ok(to_delete)
    }

    pub fn get_playlist_cache_info(&self, playlist_id: &str) -> Result<(usize, u64)> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM playlist_cached_tracks WHERE playlist_id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )?;
        let bytes: i64 = conn.query_row(
            "SELECT COALESCE(SUM(file_size), 0) FROM playlist_cached_tracks WHERE playlist_id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )?;
        Ok((count as usize, bytes as u64))
    }

    // Play History & Stats
    pub fn record_play_history(&self, id: &str, track_id: &str, duration: f64, now: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO play_history (id, track_id, played_at, duration_listened) VALUES (?1, ?2, ?3, ?4)",
            params![id, track_id, now, duration],
        )?;
        conn.execute(
            "UPDATE tracks SET play_count = play_count + 1, last_played = ?1 WHERE id = ?2",
            params![now, track_id],
        )?;
        Ok(())
    }

    pub fn get_listening_stats(&self) -> Result<ListeningStats> {
        let conn = self.conn.lock().unwrap();

        let total_week: f64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_listened), 0.0) FROM play_history WHERE datetime(played_at) >= datetime('now', '-7 days')",
            [],
            |r| r.get(0),
        ).unwrap_or(0.0);

        let total_month: f64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_listened), 0.0) FROM play_history WHERE datetime(played_at) >= datetime('now', '-30 days')",
            [],
            |r| r.get(0),
        ).unwrap_or(0.0);

        let total_tracks: i32 = conn.query_row(
            "SELECT COUNT(*) FROM play_history",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        // Top tracks
        let mut track_stmt = conn.prepare(
            "SELECT t.id, t.filepath, t.folder_id, t.title, t.artist, t.album_artist, t.album, t.year, t.genre, t.track_number, t.duration, t.cover_path, t.date_added, t.last_played, t.play_count, t.is_available,
                    COUNT(ph.id) as play_freq
             FROM tracks t
             JOIN play_history ph ON t.id = ph.track_id
             GROUP BY t.id
             ORDER BY play_freq DESC
             LIMIT 10"
        )?;

        let top_tracks_iter = track_stmt.query_map([], |row| {
            let is_available_int: i32 = row.get(15)?;
            let track = Track {
                id: row.get(0)?,
                filepath: row.get(1)?,
                folder_id: row.get(2)?,
                title: row.get(3)?,
                artist: row.get(4)?,
                album_artist: row.get(5)?,
                album: row.get(6)?,
                year: row.get(7)?,
                genre: row.get(8)?,
                track_number: row.get(9)?,
                duration: row.get(10)?,
                cover_path: row.get(11)?,
                date_added: row.get(12)?,
                last_played: row.get(13)?,
                play_count: row.get(14)?,
                is_available: is_available_int == 1,
            };
            let count: i32 = row.get(16)?;
            Ok(TopTrackStat { track, count })
        })?;

        let mut top_tracks = Vec::new();
        for item in top_tracks_iter {
            top_tracks.push(item?);
        }

        // Top artists
        let mut artist_stmt = conn.prepare(
            "SELECT t.artist, COUNT(ph.id) as play_freq
             FROM tracks t
             JOIN play_history ph ON t.id = ph.track_id
             GROUP BY t.artist
             ORDER BY play_freq DESC
             LIMIT 10"
        )?;

        let top_artists_iter = artist_stmt.query_map([], |row| {
            Ok(TopArtistStat {
                artist: row.get(0)?,
                count: row.get(1)?,
            })
        })?;

        let mut top_artists = Vec::new();
        for item in top_artists_iter {
            top_artists.push(item?);
        }

        Ok(ListeningStats {
            total_listen_time_seconds_week: total_week,
            total_listen_time_seconds_month: total_month,
            top_tracks,
            top_artists,
            total_tracks_played: total_tracks,
        })
    }

    // Settings
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            let val: String = row.get(0)?;
            Ok(Some(val))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}
