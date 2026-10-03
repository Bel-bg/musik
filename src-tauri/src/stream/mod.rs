use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom};
use tokio::net::TcpListener;
use sha2::Digest;
use crate::db::Database;

pub struct StreamServer {
    pub port: u16,
    pub token: String,
}

impl StreamServer {
    pub async fn start(db: Arc<Database>) -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind stream server: {}", e))?;

        let port = listener
            .local_addr()
            .map_err(|e| e.to_string())?
            .port();

        let token = format!(
            "{:x}",
            sha2::Sha256::digest(
                format!(
                    "{}_{}",
                    port,
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_nanos())
                        .unwrap_or(42)
                )
                .as_bytes()
            )
        );

        let token_clone = token.clone();
        tokio::spawn(async move {
            run_server_loop(listener, db, token_clone).await;
        });

        Ok(Self { port, token })
    }
}

async fn run_server_loop(listener: TcpListener, db: Arc<Database>, token: String) {
    loop {
        match listener.accept().await {
            Ok((socket, _)) => {
                let db_clone = db.clone();
                let token_clone = token.clone();
                tokio::spawn(async move {
                    if let Err(_) = handle_connection(socket, db_clone, &token_clone).await {
                        // Client disconnects or aborted streams are normal during seek/playback
                    }
                });
            }
            Err(e) => {
                eprintln!("[StreamServer] Accept error: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
        }
    }
}

async fn handle_connection(
    mut socket: tokio::net::TcpStream,
    db: Arc<Database>,
    expected_token: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = [0u8; 4096];
    let n = socket.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }

    let req_str = String::from_utf8_lossy(&buf[..n]);
    let mut lines = req_str.lines();
    let request_line = match lines.next() {
        Some(l) => l,
        None => return Ok(()),
    };

    let mut parts = request_line.split_whitespace();
    let method = match parts.next() {
        Some(m) => m,
        None => return Ok(()),
    };
    let uri = match parts.next() {
        Some(u) => u,
        None => return Ok(()),
    };

    // Handle CORS preflight
    if method == "OPTIONS" {
        let resp = "HTTP/1.1 204 No Content\r\n\
                    Access-Control-Allow-Origin: *\r\n\
                    Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
                    Access-Control-Allow-Headers: Range, Content-Type\r\n\
                    Connection: close\r\n\r\n";
        socket.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    if method != "GET" && method != "HEAD" {
        let resp = "HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n";
        socket.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    // URI format: /stream/{track_id}?token=...
    let (path_part, query_part) = match uri.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (uri, None),
    };

    // Verify token
    let mut token_valid = false;
    if let Some(q) = query_part {
        for param in q.split('&') {
            if let Some((k, v)) = param.split_once('=') {
                if k == "token" && v == expected_token {
                    token_valid = true;
                    break;
                }
            }
        }
    }

    if !token_valid {
        let resp = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\nAccess Denied";
        socket.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    let track_id = match path_part.strip_prefix("/stream/") {
        Some(id) if !id.is_empty() => id,
        _ => {
            let resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nInvalid Path";
            socket.write_all(resp.as_bytes()).await?;
            return Ok(());
        }
    };

    // Find audio file:
    // 1. Check local audio cache first (so playlists work even if external drive is unplugged)
    let file_path: Option<PathBuf> = if let Ok(Some(cached_path)) = db.get_cached_track_path(track_id) {
        let p = PathBuf::from(cached_path);
        if p.is_file() {
            Some(p)
        } else {
            None
        }
    } else {
        None
    };

    // 2. Fallback to track.filepath
    let file_path = match file_path {
        Some(p) => p,
        None => match db.get_track_by_id(track_id) {
            Ok(Some(track)) => {
                let p = PathBuf::from(track.filepath);
                if p.is_file() {
                    p
                } else {
                    let resp = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nFile Not Found on Disk";
                    socket.write_all(resp.as_bytes()).await?;
                    return Ok(());
                }
            }
            _ => {
                let resp = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nTrack Not Found";
                socket.write_all(resp.as_bytes()).await?;
                return Ok(());
            }
        },
    };

    let mut file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(_) => {
            let resp = "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\nFailed to open audio file";
            socket.write_all(resp.as_bytes()).await?;
            return Ok(());
        }
    };

    let metadata = file.metadata().await?;
    let file_len = metadata.len();

    // Determine MIME type
    let mime = match file_path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()).as_deref() {
        Some("mp3") => "audio/mpeg",
        Some("flac") => "audio/flac",
        Some("ogg") => "audio/ogg",
        Some("m4a") | Some("aac") => "audio/mp4",
        Some("wav") => "audio/wav",
        _ => "application/octet-stream",
    };

    // Check Range header
    let mut range_header: Option<&str> = None;
    for line in lines {
        if line.to_ascii_lowercase().starts_with("range:") {
            if let Some((_, r)) = line.split_once(':') {
                range_header = Some(r.trim());
                break;
            }
        }
    }

    if let Some(range_val) = range_header {
        if let Some(bytes_range) = range_val.strip_prefix("bytes=") {
            let (start_str, end_str) = match bytes_range.split_once('-') {
                Some((s, e)) => (s.trim(), e.trim()),
                None => (bytes_range.trim(), ""),
            };

            let start: u64 = if start_str.is_empty() {
                let suffix: u64 = end_str.parse().unwrap_or(0);
                file_len.saturating_sub(suffix)
            } else {
                start_str.parse().unwrap_or(0)
            };

            let end: u64 = if end_str.is_empty() {
                file_len.saturating_sub(1)
            } else {
                end_str.parse().unwrap_or(file_len.saturating_sub(1)).min(file_len.saturating_sub(1))
            };

            if start <= end && start < file_len {
                let chunk_len = end - start + 1;
                let header = format!(
                    "HTTP/1.1 206 Partial Content\r\n\
                     Content-Type: {}\r\n\
                     Content-Range: bytes {}-{}/{}\r\n\
                     Content-Length: {}\r\n\
                     Accept-Ranges: bytes\r\n\
                     Access-Control-Allow-Origin: *\r\n\
                     Connection: close\r\n\r\n",
                    mime, start, end, file_len, chunk_len
                );
                socket.write_all(header.as_bytes()).await?;

                if method == "GET" {
                    file.seek(SeekFrom::Start(start)).await?;
                    let mut reader = file.take(chunk_len);
                    tokio::io::copy(&mut reader, &mut socket).await?;
                }
                return Ok(());
            }
        }
    }

    // Default full content
    let header = format!(
        "HTTP/1.1 200 OK\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Accept-Ranges: bytes\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Connection: close\r\n\r\n",
        mime, file_len
    );
    socket.write_all(header.as_bytes()).await?;

    if method == "GET" {
        tokio::io::copy(&mut file, &mut socket).await?;
    }

    Ok(())
}
