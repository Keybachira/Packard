use crate::music::{MusicEngine, Playlist};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

/// User's music state persisted to `app_config_dir/music.json`: favorites,
/// playlists, recently-played history, queue order and shuffle/repeat flags.
/// Track ids are stable (hashed from file paths), so everything survives
/// library rescans and app restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MusicPersist {
    pub favorite_ids: Vec<String>,
    pub playlists: Vec<Playlist>,
    pub history_ids: Vec<String>,
    pub shuffle: bool,
    pub repeat: bool,
    pub queue_ids: Vec<String>,
    /// Id of the track the queue is currently sitting on (used to restore the
    /// queue cursor after a restart).
    pub current_track_id: Option<String>,
}

impl Default for MusicPersist {
    fn default() -> Self {
        Self {
            favorite_ids: Vec::new(),
            playlists: Vec::new(),
            history_ids: Vec::new(),
            shuffle: false,
            repeat: false,
            queue_ids: Vec::new(),
            current_track_id: None,
        }
    }
}

impl MusicPersist {
    fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("failed to resolve config dir: {e}"))?;
        std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create config dir: {e}"))?;
        Ok(dir.join("music.json"))
    }

    /// Snapshot the current engine state so it can be written to disk.
    pub fn collect(engine: &MusicEngine) -> Self {
        Self {
            favorite_ids: engine
                .library
                .iter()
                .filter(|t| t.favorite)
                .map(|t| t.id.clone())
                .collect(),
            playlists: engine.playlists.clone(),
            history_ids: engine.history_ids(),
            shuffle: engine.playback.shuffle,
            repeat: engine.playback.repeat,
            queue_ids: engine.queue_ids(),
            current_track_id: engine.playback.track_id.clone(),
        }
    }

    /// Re-apply persisted state onto the engine, dropping references to
    /// tracks that no longer exist in the library.
    pub fn apply_to(&self, engine: &mut MusicEngine) {
        let known: std::collections::HashSet<String> =
            engine.library.iter().map(|t| t.id.clone()).collect();

        for track in engine.library.iter_mut() {
            track.favorite = self.favorite_ids.contains(&track.id);
        }

        engine.playlists.clear();
        for playlist in &self.playlists {
            let valid: Vec<String> = playlist
                .track_ids
                .iter()
                .filter(|id| known.contains(*id))
                .cloned()
                .collect();
            engine.playlists.push(Playlist {
                id: playlist.id.clone(),
                name: playlist.name.clone(),
                track_ids: valid,
            });
        }

        let history: Vec<String> = self
            .history_ids
            .iter()
            .filter(|id| known.contains(*id))
            .cloned()
            .collect();
        engine.set_history(history);

        engine.playback.shuffle = self.shuffle;
        engine.playback.repeat = self.repeat;

        let queue: Vec<String> = self
            .queue_ids
            .iter()
            .filter(|id| known.contains(*id))
            .cloned()
            .collect();
        if !queue.is_empty() {
            engine.set_queue(queue);
            if let Some(current) = &self.current_track_id {
                if let Some(pos) = engine.queue_ids().iter().position(|id| id == current) {
                    engine.set_queue_index(pos);
                }
            }
        }
    }

    pub fn load(app: &tauri::AppHandle) -> Self {
        let path = match Self::path(app) {
            Ok(p) => p,
            Err(_) => return Self::default(),
        };
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, app: &tauri::AppHandle) -> Result<(), String> {
        let path = Self::path(app)?;
        let raw = serde_json::to_string_pretty(self).map_err(|e| format!("serialize: {e}"))?;
        std::fs::write(path, raw).map_err(|e| format!("write music state: {e}"))
    }
}