pub mod commands;
pub mod db;
pub mod library;
pub mod stream;
pub mod watcher;

use commands::*;
use db::Database;
use library::Scanner;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("musik"));

            let app_cache_dir = app
                .path()
                .app_cache_dir()
                .unwrap_or_else(|_| dirs::cache_dir().unwrap_or_else(|| PathBuf::from(".")).join("musik"));

            let _ = std::fs::create_dir_all(&app_data_dir);
            let _ = std::fs::create_dir_all(&app_cache_dir);

            let db_path = app_data_dir.join("musik.db");
            let db = Arc::new(Database::init(db_path).expect("Echec initialisation base de donnees SQLite"));
            let scanner = Arc::new(Scanner::new(app_cache_dir.clone()));

            // Start local HTTP audio streaming server with Range support
            let db_stream = db.clone();
            let stream_server = tauri::async_runtime::block_on(async move {
                stream::StreamServer::start(db_stream).await
            })
            .expect("Echec demarrage du serveur de streaming audio");

            let stream_port = stream_server.port;
            let stream_token = stream_server.token;

            // Background startup revalidation and rescan
            let db_clone = db.clone();
            let scanner_clone = scanner.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(folders) = db_clone.get_watched_folders() {
                    for folder in folders {
                        if folder.is_active {
                            scanner_clone.scan_folder(&db_clone, &folder.id, std::path::Path::new(&folder.path));
                        }
                    }
                }
            });

            // Start watcher for active folders
            if let Ok(folders) = db.get_watched_folders() {
                let paths: Vec<String> = folders
                    .into_iter()
                    .filter(|f| f.is_active)
                    .map(|f| f.path)
                    .collect();

                let db_watcher = db.clone();
                let scanner_watcher = scanner.clone();
                watcher::LibraryWatcher::start_watching(
                    paths,
                    Arc::new(move || {
                        if let Ok(folders) = db_watcher.get_watched_folders() {
                            for folder in folders {
                                if folder.is_active {
                                    scanner_watcher.scan_folder(
                                        &db_watcher,
                                        &folder.id,
                                        std::path::Path::new(&folder.path),
                                    );
                                }
                            }
                        }
                    }),
                );
            }

            app.manage(AppState {
                db,
                scanner,
                cache_dir: app_cache_dir,
                stream_port,
                stream_token,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_watched_folders,
            add_watched_folder,
            remove_watched_folder,
            rescan_library,
            get_tracks,
            get_albums,
            get_artists,
            get_genres,
            search_library,
            get_playlists,
            get_playlist_tracks,
            create_playlist,
            rename_playlist,
            delete_playlist,
            add_tracks_to_playlist,
            remove_track_from_playlist,
            reorder_playlist_tracks,
            export_playlist_m3u,
            import_playlist_m3u,
            record_play_history,
            get_listening_stats,
            get_settings,
            save_setting,
            scan_music_folder,
            extract_mp3_cover,
            get_stream_info,
            get_audio_cache_stats,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors de l'execution de l'application MUSIK");
}
