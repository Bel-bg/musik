use crate::db::{Database, Track};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus"];
pub const IMAGE_NAMES: &[&str] = &[
    "cover.jpg", "cover.png", "cover.jpeg",
    "folder.jpg", "folder.png", "folder.jpeg",
    "album.jpg", "album.png", "album.jpeg",
    "front.jpg", "front.png", "front.jpeg",
];

pub struct Scanner {
    cache_dir: PathBuf,
}

impl Scanner {
    pub fn new(cache_dir: PathBuf) -> Self {
        let covers_dir = cache_dir.join("covers");
        let _ = fs::create_dir_all(&covers_dir);
        Self { cache_dir }
    }

    pub fn scan_folder(&self, db: &Database, folder_id: &str, folder_path: &Path) -> usize {
        if !folder_path.exists() || !folder_path.is_dir() {
            return 0;
        }

        let mut count = 0;
        let now = chrono_now();

        for entry in WalkDir::new(folder_path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                        if let Some(track) = self.extract_track_info(folder_id, path, &now) {
                            if db.insert_or_update_track(&track).is_ok() {
                                count += 1;
                            }
                        }
                    }
                }
            }
        }

        count
    }

    pub fn extract_track_info(&self, folder_id: &str, filepath: &Path, now: &str) -> Option<Track> {
        let filepath_str = filepath.to_string_lossy().to_string();
        let fallback_title = filepath
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Morceau sans titre".to_string());

        let mut title = fallback_title;
        let mut artist = "Artiste inconnu".to_string();
        let mut album_artist = None;
        let mut album = "Album inconnu".to_string();
        let mut year = None;
        let mut genre = None;
        let mut track_number = None;
        let mut duration = 0.0;
        let mut cover_path = None;

        // Try reading with Lofty
        if let Ok(tagged_file) = Probe::open(filepath).and_then(|p| p.read()) {
            let properties = tagged_file.properties();
            duration = properties.duration().as_secs_f64();

            if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                if let Some(t) = tag.get_string(&ItemKey::TrackTitle) {
                    if !t.trim().is_empty() {
                        title = t.trim().to_string();
                    }
                }

                if let Some(a) = tag.get_string(&ItemKey::TrackArtist) {
                    if !a.trim().is_empty() {
                        artist = a.trim().to_string();
                    }
                }

                if let Some(aa) = tag.get_string(&ItemKey::AlbumArtist) {
                    if !aa.trim().is_empty() {
                        album_artist = Some(aa.trim().to_string());
                    }
                }

                if let Some(al) = tag.get_string(&ItemKey::AlbumTitle) {
                    if !al.trim().is_empty() {
                        album = al.trim().to_string();
                    }
                }

                if let Some(g) = tag.get_string(&ItemKey::Genre) {
                    if !g.trim().is_empty() {
                        genre = Some(g.trim().to_string());
                    }
                }

                if let Some(yr) = tag.year() {
                    year = Some(yr as i32);
                }

                if let Some(num) = tag.track() {
                    track_number = Some(num as i32);
                }

                // Check embedded picture (Priority 1)
                let pictures = tag.pictures();
                if let Some(picture) = pictures.first() {
                    if let Some(saved_path) = self.save_picture_to_cache(picture.data()) {
                        cover_path = Some(saved_path);
                    }
                }
            }
        }

        // Priority 2: In absence of embedded picture, look in parent folder for cover image
        if cover_path.is_none() {
            if let Some(parent) = filepath.parent() {
                for img_name in IMAGE_NAMES {
                    let img_path = parent.join(img_name);
                    if img_path.exists() && img_path.is_file() {
                        cover_path = Some(img_path.to_string_lossy().to_string());
                        break;
                    }
                }
            }
        }

        // Unique ID based on SHA256 of filepath
        let mut hasher = Sha256::new();
        hasher.update(filepath_str.as_bytes());
        let id = format!("{:x}", hasher.finalize());

        Some(Track {
            id,
            filepath: filepath_str,
            folder_id: folder_id.to_string(),
            title,
            artist,
            album_artist,
            album,
            year,
            genre,
            track_number,
            duration,
            cover_path,
            date_added: now.to_string(),
            last_played: None,
            play_count: 0,
            is_available: true,
        })
    }

    fn save_picture_to_cache(&self, data: &[u8]) -> Option<String> {
        if data.is_empty() {
            return None;
        }

        let mut hasher = Sha256::new();
        hasher.update(data);
        let hash = format!("{:x}", hasher.finalize());

        // Detect file format from magic bytes
        let ext = if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            "png"
        } else if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
            "jpg"
        } else if data.starts_with(b"RIFF") && data.len() > 11 && &data[8..12] == b"WEBP" {
            "webp"
        } else if data.starts_with(b"GIF") {
            "gif"
        } else {
            // Unknown format — treat as JPEG (most common for ID3 APIC)
            "jpg"
        };

        let target_file = self.cache_dir.join("covers").join(format!("{}.{}", hash, ext));
        if target_file.exists() {
            return Some(target_file.to_string_lossy().to_string());
        }

        if fs::write(&target_file, data).is_ok() {
            Some(target_file.to_string_lossy().to_string())
        } else {
            None
        }
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", since_the_epoch.as_secs())
}
