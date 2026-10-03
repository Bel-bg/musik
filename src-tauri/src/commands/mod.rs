use crate::db::{AppSettings, Database, ListeningStats, Playlist, Track, WatchedFolder};
use crate::library::Scanner;
use serde::Serialize;
use sha2::Digest;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

pub struct AppState {
    pub db: Arc<Database>,
    pub scanner: Arc<Scanner>,
    pub cache_dir: PathBuf,
    pub stream_port: u16,
    pub stream_token: String,
}

#[derive(Serialize)]
pub struct StreamInfo {
    pub port: u16,
    pub token: String,
    pub base_url: String,
}

#[derive(Serialize)]
pub struct CacheStats {
    pub total_bytes: u64,
    pub max_bytes: u64,
}

#[derive(Serialize)]
pub struct RescanResult {
    pub count: usize,
}

#[derive(Serialize, Clone)]
pub struct AlbumDto {
    pub name: String,
    pub artist: String,
    pub year: Option<i32>,
    pub cover_path: Option<String>,
    pub track_count: usize,
    pub total_duration: f64,
    pub tracks: Vec<Track>,
}

#[derive(Serialize, Clone)]
pub struct ArtistDto {
    pub name: String,
    pub track_count: usize,
    pub album_count: usize,
    pub albums: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct GenreDto {
    pub name: String,
    pub count: usize,
}

#[derive(Serialize)]
pub struct SearchResultDto {
    pub tracks: Vec<Track>,
    pub albums: Vec<AlbumDto>,
    pub artists: Vec<ArtistDto>,
    pub playlists: Vec<Playlist>,
}

// Folders
#[tauri::command]
pub async fn get_watched_folders(state: State<'_, AppState>) -> Result<Vec<WatchedFolder>, String> {
    state.db.get_watched_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_watched_folder(
    path: String,
    state: State<'_, AppState>,
) -> Result<WatchedFolder, String> {
    let now = chrono_now();
    let id = format!("{:x}", sha2::Sha256::digest(path.as_bytes()));
    let folder = WatchedFolder {
        id: id.clone(),
        path: path.clone(),
        date_added: now.clone(),
        last_scan: Some(now),
        is_active: true,
        is_accessible: Some(Path::new(&path).exists()),
    };

    state
        .db
        .add_watched_folder(&folder)
        .map_err(|e| e.to_string())?;

    // Immediate scan of added folder
    let db = state.db.clone();
    let scanner = state.scanner.clone();
    let folder_id = folder.id.clone();
    let folder_path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || {
        scanner.scan_folder(&db, &folder_id, &folder_path);
    });

    Ok(folder)
}

#[tauri::command]
pub async fn remove_watched_folder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.remove_watched_folder(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rescan_library(state: State<'_, AppState>) -> Result<RescanResult, String> {
    let folders = state.db.get_watched_folders().map_err(|e| e.to_string())?;
    let db = state.db.clone();
    let scanner = state.scanner.clone();

    let count = tokio::task::spawn_blocking(move || {
        let mut total = 0;
        for folder in folders {
            if folder.is_active {
                total += scanner.scan_folder(&db, &folder.id, Path::new(&folder.path));
            }
        }
        total
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(RescanResult { count })
}

// Tracks & Navigation
#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    state.db.get_tracks().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<AlbumDto>, String> {
    let tracks = state.db.get_tracks().map_err(|e| e.to_string())?;
    let mut album_map: HashMap<String, (String, String, Option<i32>, Option<String>, Vec<Track>)> =
        HashMap::new();

    for track in tracks {
        let key = format!("{}|||{}", track.album, track.album_artist.as_ref().unwrap_or(&track.artist));
        let entry = album_map.entry(key).or_insert_with(|| {
            (
                track.album.clone(),
                track.album_artist.clone().unwrap_or_else(|| track.artist.clone()),
                track.year,
                track.cover_path.clone(),
                Vec::new(),
            )
        });
        if entry.3.is_none() && track.cover_path.is_some() {
            entry.3 = track.cover_path.clone();
        }
        entry.4.push(track);
    }

    let mut albums: Vec<AlbumDto> = album_map
        .into_values()
        .map(|(name, artist, year, cover_path, mut tracks)| {
            tracks.sort_by_key(|t| t.track_number.unwrap_or(0));
            let track_count = tracks.len();
            let total_duration = tracks.iter().map(|t| t.duration).sum();
            AlbumDto {
                name,
                artist,
                year,
                cover_path,
                track_count,
                total_duration,
                tracks,
            }
        })
        .collect();

    albums.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(albums)
}

#[tauri::command]
pub async fn get_artists(state: State<'_, AppState>) -> Result<Vec<ArtistDto>, String> {
    let tracks = state.db.get_tracks().map_err(|e| e.to_string())?;
    let mut artist_map: HashMap<String, (usize, HashSet<String>)> = HashMap::new();

    for track in tracks {
        let entry = artist_map.entry(track.artist.clone()).or_insert_with(|| (0, HashSet::new()));
        entry.0 += 1;
        entry.1.insert(track.album);
    }

    let mut artists: Vec<ArtistDto> = artist_map
        .into_iter()
        .map(|(name, (track_count, album_set))| ArtistDto {
            name,
            track_count,
            album_count: album_set.len(),
            albums: album_set.into_iter().collect(),
        })
        .collect();

    artists.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(artists)
}

#[tauri::command]
pub async fn get_genres(state: State<'_, AppState>) -> Result<Vec<GenreDto>, String> {
    let tracks = state.db.get_tracks().map_err(|e| e.to_string())?;
    let mut genre_map: HashMap<String, usize> = HashMap::new();

    for track in tracks {
        let g = track.genre.unwrap_or_else(|| "Inconnu".to_string());
        *genre_map.entry(g).or_insert(0) += 1;
    }

    let mut genres: Vec<GenreDto> = genre_map
        .into_iter()
        .map(|(name, count)| GenreDto { name, count })
        .collect();

    genres.sort_by(|a, b| b.count.cmp(&a.count));
    Ok(genres)
}

#[tauri::command]
pub async fn search_library(
    query: String,
    state: State<'_, AppState>,
) -> Result<SearchResultDto, String> {
    let clean = query.trim().to_lowercase();
    let all_tracks = state.db.get_tracks().map_err(|e| e.to_string())?;
    let all_playlists = state.db.get_playlists().map_err(|e| e.to_string())?;

    let matched_tracks: Vec<Track> = all_tracks
        .iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&clean)
                || t.artist.to_lowercase().contains(&clean)
                || t.album.to_lowercase().contains(&clean)
        })
        .cloned()
        .collect();

    let matched_playlists: Vec<Playlist> = all_playlists
        .into_iter()
        .filter(|p| p.name.to_lowercase().contains(&clean))
        .collect();

    let mut album_set = HashSet::new();
    let mut matched_albums = Vec::new();

    let mut artist_set = HashSet::new();
    let mut matched_artists = Vec::new();

    for t in &all_tracks {
        if t.album.to_lowercase().contains(&clean) && album_set.insert(t.album.clone()) {
            matched_albums.push(AlbumDto {
                name: t.album.clone(),
                artist: t.artist.clone(),
                year: t.year,
                cover_path: t.cover_path.clone(),
                track_count: 1,
                total_duration: t.duration,
                tracks: vec![t.clone()],
            });
        }

        if t.artist.to_lowercase().contains(&clean) && artist_set.insert(t.artist.clone()) {
            matched_artists.push(ArtistDto {
                name: t.artist.clone(),
                track_count: 1,
                album_count: 1,
                albums: vec![t.album.clone()],
            });
        }
    }

    Ok(SearchResultDto {
        tracks: matched_tracks,
        albums: matched_albums,
        artists: matched_artists,
        playlists: matched_playlists,
    })
}

// Playlists
#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    state.db.get_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlist_tracks(
    playlist_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Track>, String> {
    state
        .db
        .get_playlist_tracks(&playlist_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_playlist(
    name: String,
    cover_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Playlist, String> {
    let now = chrono_now();
    let id = format!("{:x}", sha2::Sha256::digest(format!("{}{}", name, now).as_bytes()));
    state
        .db
        .create_playlist(&id, &name, cover_path.as_deref(), &now)
        .map_err(|e| e.to_string())?;

    Ok(Playlist {
        id,
        name,
        cover_path,
        created_at: now.clone(),
        updated_at: now,
        position: 0,
        track_count: 0,
    })
}

#[tauri::command]
pub async fn rename_playlist(
    id: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono_now();
    state
        .db
        .rename_playlist(&id, &name, &now)
        .map_err(|e| e.to_string())
}

const MAX_AUDIO_CACHE_BYTES: u64 = 10 * 1024 * 1024 * 1024; // 10 GB limit

async fn cache_tracks_for_playlist(
    db: Arc<Database>,
    audio_cache_dir: PathBuf,
    playlist_id: String,
    track_ids: Vec<String>,
) {
    if let Err(e) = tokio::fs::create_dir_all(&audio_cache_dir).await {
        eprintln!("[AudioCache] Failed to create audio cache dir: {}", e);
        return;
    }

    for track_id in track_ids {
        let track = match db.get_track_by_id(&track_id) {
            Ok(Some(t)) => t,
            _ => continue,
        };

        let src_path = PathBuf::from(&track.filepath);
        if !src_path.is_file() {
            continue;
        }

        let metadata = match tokio::fs::metadata(&src_path).await {
            Ok(m) => m,
            Err(_) => continue,
        };
        let file_len = metadata.len();

        let ext = src_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("mp3");
        let target_filename = format!("{}.{}", track.id, ext);
        let target_path = audio_cache_dir.join(target_filename);

        let now = chrono_now();

        // If target file already exists with same size, just record in db
        if target_path.is_file() {
            if let Ok(target_meta) = tokio::fs::metadata(&target_path).await {
                if target_meta.len() == file_len {
                    if let Some(target_str) = target_path.to_str() {
                        let _ = db.add_playlist_cached_track(&playlist_id, &track.id, target_str, file_len, &now);
                    }
                    continue;
                }
            }
        }

        // Check 10GB limit
        let current_cache_size = db.get_total_cache_size().unwrap_or(0);
        if current_cache_size + file_len > MAX_AUDIO_CACHE_BYTES {
            eprintln!(
                "[AudioCache] Limite de 10 Go atteinte (actuel: {} octets, nouveau: {} octets). Ignore pour {}",
                current_cache_size, file_len, track.title
            );
            continue;
        }

        // Copy file to cache
        match tokio::fs::copy(&src_path, &target_path).await {
            Ok(_) => {
                if let Some(target_str) = target_path.to_str() {
                    let _ = db.add_playlist_cached_track(&playlist_id, &track.id, target_str, file_len, &now);
                }
            }
            Err(e) => {
                eprintln!("[AudioCache] Erreur lors de la mise en cache de {}: {}", track.filepath, e);
            }
        }
    }
}

#[tauri::command]
pub async fn delete_playlist(id: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(orphan_files) = state.db.remove_playlist_all_cached_tracks(&id) {
        for file in orphan_files {
            let _ = tokio::fs::remove_file(file).await;
        }
    }
    state.db.delete_playlist(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_tracks_to_playlist(
    playlist_id: String,
    track_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .add_tracks_to_playlist(&playlist_id, &track_ids)
        .map_err(|e| e.to_string())?;

    // Asynchronously copy MP3s to local cache (10GB limit)
    let db = state.db.clone();
    let audio_cache_dir = state.cache_dir.join("audio");
    let playlist_id_clone = playlist_id.clone();
    let track_ids_clone = track_ids.clone();

    tauri::async_runtime::spawn(async move {
        cache_tracks_for_playlist(db, audio_cache_dir, playlist_id_clone, track_ids_clone).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn remove_track_from_playlist(
    playlist_id: String,
    track_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Ok(Some(orphan_file)) = state.db.remove_playlist_cached_track(&playlist_id, &track_id) {
        let _ = tokio::fs::remove_file(orphan_file).await;
    }
    state
        .db
        .remove_track_from_playlist(&playlist_id, &track_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_stream_info(state: State<'_, AppState>) -> Result<StreamInfo, String> {
    Ok(StreamInfo {
        port: state.stream_port,
        token: state.stream_token.clone(),
        base_url: format!("http://127.0.0.1:{}", state.stream_port),
    })
}

#[tauri::command]
pub async fn get_audio_cache_stats(state: State<'_, AppState>) -> Result<CacheStats, String> {
    let total = state.db.get_total_cache_size().unwrap_or(0);
    Ok(CacheStats {
        total_bytes: total,
        max_bytes: MAX_AUDIO_CACHE_BYTES,
    })
}

#[tauri::command]
pub async fn reorder_playlist_tracks(
    playlist_id: String,
    track_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .reorder_playlist_tracks(&playlist_id, &track_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_playlist_m3u(
    playlist_id: String,
    target_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let tracks = state
        .db
        .get_playlist_tracks(&playlist_id)
        .map_err(|e| e.to_string())?;

    let mut content = String::from("#EXTM3U\n");
    for track in tracks {
        content.push_str(&format!(
            "#EXTINF:{},{} - {}\n{}\n",
            track.duration as i64, track.artist, track.title, track.filepath
        ));
    }

    fs::write(&target_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn import_playlist_m3u(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Playlist, String> {
    let raw = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let path_obj = Path::new(&file_path);
    let playlist_name = path_obj
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Playlist importee".to_string());

    let now = chrono_now();
    let id = format!("{:x}", sha2::Sha256::digest(format!("{}{}", playlist_name, now).as_bytes()));
    state
        .db
        .create_playlist(&id, &playlist_name, None, &now)
        .map_err(|e| e.to_string())?;

    let all_tracks = state.db.get_tracks().map_err(|e| e.to_string())?;
    let mut track_ids = Vec::new();

    for line in raw.lines() {
        let line = line.trim();
        if !line.is_empty() && !line.starts_with('#') {
            if let Some(matched) = all_tracks.iter().find(|t| t.filepath == line || t.filepath.ends_with(line)) {
                track_ids.push(matched.id.clone());
            }
        }
    }

    if !track_ids.is_empty() {
        state
            .db
            .add_tracks_to_playlist(&id, &track_ids)
            .map_err(|e| e.to_string())?;
    }

    Ok(Playlist {
        id,
        name: playlist_name,
        cover_path: None,
        created_at: now.clone(),
        updated_at: now,
        position: 0,
        track_count: track_ids.len() as i32,
    })
}

// Stats & History
#[tauri::command]
pub async fn record_play_history(
    track_id: String,
    duration_listened: f64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono_now();
    let id = format!("{:x}", sha2::Sha256::digest(format!("{}{}{}", track_id, now, duration_listened).as_bytes()));
    state
        .db
        .record_play_history(&id, &track_id, duration_listened, &now)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_listening_stats(
    state: State<'_, AppState>,
) -> Result<ListeningStats, String> {
    state.db.get_listening_stats().map_err(|e| e.to_string())
}

// Settings
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let volume = state
        .db
        .get_setting("volume")
        .unwrap_or(None)
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.8);

    let is_muted = state
        .db
        .get_setting("is_muted")
        .unwrap_or(None)
        .map(|v| v == "true")
        .unwrap_or(false);

    let shuffle = state
        .db
        .get_setting("shuffle")
        .unwrap_or(None)
        .map(|v| v == "true")
        .unwrap_or(false);

    let repeat = state
        .db
        .get_setting("repeat")
        .unwrap_or(None)
        .unwrap_or_else(|| "off".to_string());

    let last_track_id = state.db.get_setting("last_track_id").unwrap_or(None);

    let last_position = state
        .db
        .get_setting("last_position")
        .unwrap_or(None)
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.0);

    let playback_speed = state
        .db
        .get_setting("playback_speed")
        .unwrap_or(None)
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(1.0);

    let restore_last_track_on_startup = state
        .db
        .get_setting("restore_last_track_on_startup")
        .unwrap_or(None)
        .map(|v| v != "false")
        .unwrap_or(true);

    let restore_last_view_on_startup = state
        .db
        .get_setting("restore_last_view_on_startup")
        .unwrap_or(None)
        .map(|v| v != "false")
        .unwrap_or(true);

    let media_keys_enabled = state
        .db
        .get_setting("media_keys_enabled")
        .unwrap_or(None)
        .map(|v| v != "false")
        .unwrap_or(true);

    Ok(AppSettings {
        volume,
        is_muted,
        shuffle,
        repeat,
        last_track_id,
        last_position,
        playback_speed,
        restore_last_track_on_startup,
        restore_last_view_on_startup,
        media_keys_enabled,
        database_path: Some(state.db.db_path.to_string_lossy().to_string()),
        cache_path: Some(state.cache_dir.to_string_lossy().to_string()),
        version: Some("1.0.0".to_string()),
    })
}

#[tauri::command]
pub async fn save_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[derive(Serialize, serde::Deserialize, Clone, Debug)]
pub struct ScannedTrackMetadata {
    pub id: String,
    pub filepath: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub track_number: Option<u32>,
    pub year: Option<i32>,
}

#[tauri::command]
pub async fn scan_music_folder(folder_path: String) -> Result<Vec<ScannedTrackMetadata>, String> {
    tokio::task::spawn_blocking(move || {
        use id3::TagLike;
        use rayon::prelude::*;
        use walkdir::WalkDir;

        let path = Path::new(&folder_path);
        if !path.exists() || !path.is_dir() {
            return Err(format!(
                "Le dossier '{}' n'existe pas ou n'est pas accessible",
                folder_path
            ));
        }

        // 1. Rapidly collect .mp3 paths using fast walkdir traversal
        let mp3_entries: Vec<PathBuf> = WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|entry| {
                if !entry.file_type().is_file() {
                    return false;
                }
                entry
                    .path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("mp3"))
                    .unwrap_or(false)
            })
            .map(|entry| entry.into_path())
            .collect();

        // 2. Parallel processing using Rayon - reading ONLY lightweight text tags
        // CRITICAL: Do NOT extract or decode picture bytes during initial scan!
        let results: Vec<ScannedTrackMetadata> = mp3_entries
            .into_par_iter()
            .map(|file_path| {
                let filepath_str = file_path.to_string_lossy().to_string();
                let mut hasher = sha2::Sha256::new();
                hasher.update(filepath_str.as_bytes());
                let id = format!("{:x}", hasher.finalize())[..16].to_string();

                let fallback_title = file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Piste inconnue")
                    .to_string();

                if let Ok(tag) = id3::Tag::read_from_path(&file_path) {
                    let title = tag.title().map(|s| s.to_string()).unwrap_or(fallback_title);
                    let artist = tag
                        .artist()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "Artiste inconnu".to_string());
                    let album = tag.album().map(|s| s.to_string()).unwrap_or_default();
                    let year = tag.year();
                    let track_number = tag.track();
                    let duration = tag.duration().map(|ms| ms as f64 / 1000.0).unwrap_or(0.0);

                    ScannedTrackMetadata {
                        id,
                        filepath: filepath_str,
                        title,
                        artist,
                        album,
                        duration,
                        track_number,
                        year,
                    }
                } else {
                    ScannedTrackMetadata {
                        id,
                        filepath: filepath_str,
                        title: fallback_title,
                        artist: "Artiste inconnu".to_string(),
                        album: String::new(),
                        duration: 0.0,
                        track_number: None,
                        year: None,
                    }
                }
            })
            .collect();

        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn extract_mp3_cover(file_path: String) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
        use base64::Engine;

        let path = Path::new(&file_path);
        if !path.exists() {
            return Ok(None);
        }

        // Read single MP3 on demand, extract first embedded picture tag
        let tag = match id3::Tag::read_from_path(path) {
            Ok(t) => t,
            Err(_) => return Ok(None),
        };

        if let Some(picture) = tag.pictures().next() {
            let mime = if picture.mime_type.is_empty() {
                "image/jpeg"
            } else {
                &picture.mime_type
            };
            let b64 = BASE64_STANDARD.encode(&picture.data);
            let data_url = format!("data:{};base64,{}", mime, b64);
            return Ok(Some(data_url));
        }

        Ok(None)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", since_the_epoch.as_secs())
}
