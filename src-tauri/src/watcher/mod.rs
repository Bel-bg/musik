use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::thread;

pub struct LibraryWatcher;

impl LibraryWatcher {
    pub fn start_watching(paths: Vec<String>, on_change: Arc<dyn Fn() + Send + Sync + 'static>) {
        if paths.is_empty() {
            return;
        }

        thread::spawn(move || {
            let (tx, rx) = channel::<Result<Event, notify::Error>>();

            let mut watcher: RecommendedWatcher = match RecommendedWatcher::new(tx, Config::default()) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("Erreur creation watcher: {:?}", e);
                    return;
                }
            };

            for p in &paths {
                let path = Path::new(p);
                if path.exists() {
                    let _ = watcher.watch(path, RecursiveMode::Recursive);
                }
            }

            for res in rx {
                match res {
                    Ok(event) => {
                        if matches!(
                            event.kind,
                            notify::EventKind::Create(_)
                                | notify::EventKind::Remove(_)
                                | notify::EventKind::Modify(_)
                        ) {
                            on_change();
                        }
                    }
                    Err(e) => eprintln!("Erreur surveillance: {:?}", e),
                }
            }
        });
    }
}
