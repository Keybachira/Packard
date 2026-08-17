use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

/// A single track in the library. Metadata + optional local file path.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f32,
    pub favorite: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub playing: bool,
    pub track_id: Option<String>,
    pub position_secs: f32,
    pub shuffle: bool,
    pub repeat: bool,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            playing: false,
            track_id: None,
            position_secs: 0.0,
            shuffle: false,
            repeat: false,
        }
    }
}

/// How many recently-played track ids the engine remembers (most recent
/// first). Persisted so the Recents tab survives restarts.
pub const HISTORY_LIMIT: usize = 60;

/// Music Engine state.
pub struct MusicEngine {
    pub library: Vec<Track>,
    pub playlists: Vec<Playlist>,
    pub playback: PlaybackState,
    /// Ordered list of track ids that will be played next. This is the REAL
    /// play queue — the SidePane renders it and the user can reorder/remove.
    queue: Vec<String>,
    queue_index: usize,
    /// Recently played track ids, most recent first.
    history: Vec<String>,
}

impl MusicEngine {
    pub fn new() -> Self {
        Self {
            library: Vec::new(),
            playlists: Vec::new(),
            playback: PlaybackState::default(),
            queue: Vec::new(),
            queue_index: 0,
            history: Vec::new(),
        }
    }

    pub fn seed_demo(&mut self) {
        self.library = vec![
            Track {
                id: "t1".into(),
                title: "Night Drive".into(),
                artist: "Neon Circuit".into(),
                album: "Afterglow".into(),
                duration_secs: 238.0,
                favorite: true,
                path: None,
            },
            Track {
                id: "t2".into(),
                title: "Glass City".into(),
                artist: "Monochrome".into(),
                album: "Polaroids".into(),
                duration_secs: 203.0,
                favorite: false,
                path: None,
            },
            Track {
                id: "t3".into(),
                title: "Slow Motion".into(),
                artist: "Echo Park".into(),
                album: "Soft Focus".into(),
                duration_secs: 287.0,
                favorite: true,
                path: None,
            },
            Track {
                id: "t4".into(),
                title: "Afterlight".into(),
                artist: "Neon Circuit".into(),
                album: "Afterglow".into(),
                duration_secs: 254.0,
                favorite: false,
                path: None,
            },
        ];
        self.playlists = vec![
            Playlist {
                id: "p1".into(),
                name: "Favorites".into(),
                track_ids: vec!["t1".into(), "t3".into()],
            },
            Playlist {
                id: "p2".into(),
                name: "Night Drive".into(),
                track_ids: vec!["t1".into(), "t2".into(), "t4".into()],
            },
        ];
    }

    fn is_known(&self, track_id: &str) -> bool {
        self.library.iter().any(|t| t.id == track_id)
    }

    /// Start playing `track_id`. If it isn't already in the real queue, build a
    /// default queue with the chosen track first followed by the rest of the
    /// library (matching the old "play from the library" behavior). Returns the
    /// id that was queued.
    pub fn play_track(&mut self, track_id: &str) -> Result<(), String> {
        if !self.is_known(track_id) {
            return Err(format!("unknown track '{track_id}'"));
        }
        if !self.queue.iter().any(|id| id == track_id) {
            let mut ids: Vec<String> = self.library.iter().map(|t| t.id.clone()).collect();
            ids.retain(|id| id != track_id);
            ids.insert(0, track_id.to_string());
            self.queue = ids;
        }
        self.queue_index = self
            .queue
            .iter()
            .position(|id| id == track_id)
            .unwrap_or(0);
        self.begin_current();
        Ok(())
    }

    /// Play a specific track against an explicit queue order (used when the UI
    /// presses "Play" on an album, artist, playlist or multi-selection). The
    /// queue is replaced entirely.
    pub fn play_collection(&mut self, track_id: &str, ids: Vec<String>) -> Result<(), String> {
        if !self.is_known(track_id) {
            return Err(format!("unknown track '{track_id}'"));
        }
        let valid: Vec<String> = ids
            .into_iter()
            .filter(|id| self.is_known(id))
            .collect();
        if !valid.iter().any(|id| id == track_id) {
            return Err(format!("'{track_id}' não está na coleção"));
        }
        self.queue = valid;
        self.queue_index = self
            .queue
            .iter()
            .position(|id| id == track_id)
            .unwrap_or(0);
        self.begin_current();
        Ok(())
    }

    /// Mark the current queue entry as the active track and record history.
    fn begin_current(&mut self) {
        if let Some(id) = self.queue.get(self.queue_index).cloned() {
            self.playback.track_id = Some(id.clone());
            self.playback.playing = true;
            self.playback.position_secs = 0.0;
            self.record_history(&id);
        }
    }

    // --- Queue operations ---------------------------------------------------

    /// Append track ids to the end of the real queue.
    pub fn enqueue(&mut self, ids: &[String]) {
        for id in ids {
            if self.is_known(id) && !self.queue.iter().any(|q| q == id) {
                self.queue.push(id.clone());
            }
        }
    }

    /// Insert track ids immediately after the current position, so they play
    /// right after the current track finishes.
    pub fn enqueue_next(&mut self, ids: &[String]) {
        let mut insert = Vec::new();
        for id in ids {
            if self.is_known(id) && !self.queue.iter().any(|q| q == id) {
                insert.push(id.clone());
            }
        }
        if insert.is_empty() {
            return;
        }
        let at = self.queue_index + 1;
        let tail = self.queue.split_off(at.min(self.queue.len()));
        self.queue.extend(insert);
        self.queue.extend(tail);
    }

    pub fn remove_from_queue(&mut self, track_id: &str) {
        if let Some(pos) = self.queue.iter().position(|id| id == track_id) {
            self.queue.remove(pos);
            if self.queue.is_empty() {
                self.queue_index = 0;
                self.playback.playing = false;
                self.playback.track_id = None;
                return;
            }
            if pos < self.queue_index {
                self.queue_index = self.queue_index.saturating_sub(1);
            } else if pos == self.queue_index {
                // The current track was removed: advance to the next entry.
                self.queue_index = self.queue_index.min(self.queue.len().saturating_sub(1));
                self.begin_current();
            }
        }
    }

    /// Move the entry at `from` to `to` (both are queue indexes).
    pub fn reorder_queue(&mut self, from: usize, to: usize) {
        if from >= self.queue.len() || to >= self.queue.len() {
            return;
        }
        let id = self.queue.remove(from);
        self.queue.insert(to, id);
        if self.queue_index == from {
            self.queue_index = to;
        } else if from < self.queue_index && to >= self.queue_index {
            self.queue_index = self.queue_index.saturating_sub(1);
        } else if from > self.queue_index && to <= self.queue_index {
            self.queue_index = self.queue_index.saturating_add(1);
        }
    }

    /// Replace the whole queue (used by the frontend drag "reset"/set-order).
    pub fn set_queue(&mut self, ids: Vec<String>) {
        self.queue = ids.into_iter().filter(|id| self.is_known(id)).collect();
        if self.queue.is_empty() {
            self.queue_index = 0;
            self.playback.playing = false;
            return;
        }
        if let Some(current) = self.playback.track_id.clone() {
            if let Some(pos) = self.queue.iter().position(|id| id == &current) {
                self.queue_index = pos;
                return;
            }
        }
        self.queue_index = self.queue_index.min(self.queue.len().saturating_sub(1));
    }

    /// Move the queue cursor to a specific index (used when restoring a
    /// persisted queue after a restart).
    pub fn set_queue_index(&mut self, index: usize) {
        if !self.queue.is_empty() {
            self.queue_index = index.min(self.queue.len().saturating_sub(1));
        }
    }

    pub fn clear_queue(&mut self) {
        self.queue.clear();
        self.queue_index = 0;
        self.playback.playing = false;
    }

    // --- Playback control ---------------------------------------------------

    pub fn toggle_pause(&mut self) {
        self.playback.playing = !self.playback.playing;
    }

    /// Advance to the next queue entry. Honors repeat (wrap at the end) and
    /// shuffle (pick a random remaining entry). When repeat is off and the
    /// queue ends, playback stops.
    pub fn next(&mut self) {
        if self.queue.is_empty() {
            return;
        }
        if self.playback.shuffle && self.queue.len() > 1 {
            let mut pool: Vec<usize> = (0..self.queue.len()).collect();
            pool.retain(|&i| i != self.queue_index);
            let Some(&pick) = pool.choose(&mut rand::thread_rng()) else {
                return;
            };
            self.queue_index = pick;
        } else if self.playback.repeat || self.queue_index + 1 < self.queue.len() {
            self.queue_index = (self.queue_index + 1) % self.queue.len();
        } else {
            self.playback.playing = false;
            return;
        }
        self.begin_current();
    }

    pub fn previous(&mut self) {
        if self.queue.is_empty() {
            return;
        }
        if self.queue_index == 0 {
            self.queue_index = self.queue.len() - 1;
        } else {
            self.queue_index -= 1;
        }
        self.begin_current();
    }

    pub fn set_shuffle(&mut self, shuffle: bool) {
        self.playback.shuffle = shuffle;
    }

    pub fn set_repeat(&mut self, repeat: bool) {
        self.playback.repeat = repeat;
    }

    pub fn seek(&mut self, secs: f32) -> f32 {
        let target = secs.max(0.0);
        if let Some(id) = self.playback.track_id.clone() {
            if let Some(track) = self.library.iter().find(|t| t.id == id) {
                let clamped = target.min(track.duration_secs.max(0.0));
                self.playback.position_secs = clamped;
                return clamped;
            }
        }
        target
    }

    // --- History ------------------------------------------------------------

    fn record_history(&mut self, track_id: &str) {
        self.history.retain(|id| id != track_id);
        self.history.insert(0, track_id.to_string());
        self.history.truncate(HISTORY_LIMIT);
    }

    /// Recently played track ids, most recent first.
    pub fn history_ids(&self) -> Vec<String> {
        self.history.clone()
    }

    pub fn set_history(&mut self, ids: Vec<String>) {
        self.history = ids;
        self.history.truncate(HISTORY_LIMIT);
    }

    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    // --- Favorites ----------------------------------------------------------

    /// Toggle a track's favorite flag. Returns the affected id.
    pub fn toggle_favorite(&mut self, track_id: &str) -> Result<bool, String> {
        let track = self
            .library
            .iter_mut()
            .find(|t| t.id == track_id)
            .ok_or_else(|| format!("unknown track '{track_id}'"))?;
        track.favorite = !track.favorite;
        Ok(track.favorite)
    }

    // --- Playlists ----------------------------------------------------------

    pub fn create_playlist(&mut self, name: &str) -> Result<Playlist, String> {
        let name = name.trim();
        if name.is_empty() {
            return Err("nome da playlist não pode ser vazio".into());
        }
        let id = format!("pl{}", self.playlists.len() + 1);
        let playlist = Playlist {
            id,
            name: name.to_string(),
            track_ids: Vec::new(),
        };
        self.playlists.push(playlist.clone());
        Ok(playlist)
    }

    pub fn rename_playlist(&mut self, playlist_id: &str, name: &str) -> Result<Playlist, String> {
        let name = name.trim();
        if name.is_empty() {
            return Err("nome da playlist não pode ser vazio".into());
        }
        let playlist = self
            .playlists
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| format!("playlist '{playlist_id}' não encontrada"))?;
        playlist.name = name.to_string();
        Ok(playlist.clone())
    }

    pub fn delete_playlist(&mut self, playlist_id: &str) -> Result<(), String> {
        let len = self.playlists.len();
        self.playlists.retain(|p| p.id != playlist_id);
        if self.playlists.len() == len {
            return Err(format!("playlist '{playlist_id}' não encontrada"));
        }
        Ok(())
    }

    pub fn add_to_playlist(&mut self, playlist_id: &str, track_ids: &[String]) -> Result<Playlist, String> {
        let valid: Vec<String> = track_ids
            .iter()
            .filter(|id| self.is_known(id))
            .cloned()
            .collect();
        let playlist = self
            .playlists
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| format!("playlist '{playlist_id}' não encontrada"))?;
        for id in valid {
            if !playlist.track_ids.contains(&id) {
                playlist.track_ids.push(id);
            }
        }
        Ok(playlist.clone())
    }

    pub fn remove_from_playlist(&mut self, playlist_id: &str, track_id: &str) -> Result<Playlist, String> {
        let playlist = self
            .playlists
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| format!("playlist '{playlist_id}' não encontrada"))?;
        playlist.track_ids.retain(|id| id != track_id);
        Ok(playlist.clone())
    }

    // --- Getters ------------------------------------------------------------

    /// Tracks currently in the play queue, resolved to full metadata.
    pub fn resolved_queue(&self) -> Vec<Track> {
        self.queue
            .iter()
            .filter_map(|id| self.library.iter().find(|t| t.id == *id))
            .cloned()
            .collect()
    }

    /// Queue order as raw ids (used by the frontend to persist a drag order).
    pub fn queue_ids(&self) -> Vec<String> {
        self.queue.clone()
    }

    /// Recently played tracks, resolved to full metadata (most recent first).
    pub fn resolved_history(&self) -> Vec<Track> {
        self.history
            .iter()
            .filter_map(|id| self.library.iter().find(|t| t.id == *id))
            .cloned()
            .collect()
    }
}

impl Default for MusicEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine() -> MusicEngine {
        let mut e = MusicEngine::new();
        e.seed_demo();
        e
    }

    #[test]
    fn play_track_builds_default_queue_with_track_first() {
        let mut e = engine();
        e.play_track("t3").unwrap();
        assert_eq!(e.playback.track_id.as_deref(), Some("t3"));
        let ids = e.queue_ids();
        assert_eq!(ids.first().map(String::as_str), Some("t3"));
        assert_eq!(ids.len(), 4);
    }

    #[test]
    fn play_track_unknown_errors() {
        let mut e = engine();
        assert!(e.play_track("nope").is_err());
    }

    #[test]
    fn enqueue_appends_and_skips_duplicates() {
        let mut e = engine();
        e.play_track("t1").unwrap();
        e.set_queue(vec!["t1".into(), "t2".into()]);
        e.enqueue(&["t2".into(), "t3".into()]);
        let ids = e.queue_ids();
        assert_eq!(ids, vec!["t1", "t2", "t3"]);
    }

    #[test]
    fn enqueue_next_inserts_after_current() {
        let mut e = engine();
        e.play_track("t1").unwrap();
        e.set_queue(vec!["t1".into(), "t2".into()]);
        e.enqueue_next(&["t4".into()]);
        let ids = e.queue_ids();
        assert_eq!(ids, vec!["t1", "t4", "t2"]);
    }

    #[test]
    fn remove_from_queue_adjusts_index() {
        let mut e = engine();
        e.play_track("t1").unwrap(); // index 0, queue t1..t4
        e.remove_from_queue("t1");
        assert_eq!(e.playback.track_id.as_deref(), Some("t2"));
        assert_eq!(e.queue_ids(), vec!["t2", "t3", "t4"]);
    }

    #[test]
    fn remove_last_track_stops_playback() {
        let mut e = engine();
        e.play_track("t1").unwrap();
        e.remove_from_queue("t1");
        e.remove_from_queue("t2");
        e.remove_from_queue("t3");
        e.remove_from_queue("t4");
        assert!(e.queue_ids().is_empty());
        assert!(!e.playback.playing);
    }

    #[test]
    fn reorder_queue_moves_current() {
        let mut e = engine();
        e.play_track("t1").unwrap(); // index 0
        e.reorder_queue(0, 2);
        assert_eq!(e.queue_ids(), vec!["t2", "t3", "t1", "t4"]);
        assert_eq!(e.queue_index, 2);
        assert_eq!(e.playback.track_id.as_deref(), Some("t1"));
    }

    #[test]
    fn next_wraps_with_repeat_and_stops_without() {
        let mut e = engine();
        e.play_track("t1").unwrap();
        e.set_queue(vec!["t1".into(), "t2".into()]);
        e.set_repeat(false);
        e.next();
        assert_eq!(e.playback.track_id.as_deref(), Some("t2"));
        e.next();
        assert!(!e.playback.playing);
        assert_eq!(e.playback.track_id.as_deref(), Some("t2"));

        e.play_track("t1").unwrap();
        e.set_queue(vec!["t1".into(), "t2".into()]);
        e.set_repeat(true);
        e.next();
        e.next();
        assert_eq!(e.playback.track_id.as_deref(), Some("t1"));
        assert!(e.playback.playing);
    }

    #[test]
    fn shuffle_next_picks_different_track() {
        let mut e = engine();
        e.play_track("t1").unwrap();
        e.set_queue(vec!["t1".into(), "t2".into(), "t3".into()]);
        e.set_shuffle(true);
        e.next();
        let id = e.playback.track_id.unwrap();
        assert_ne!(id, "t1");
        assert!(["t2", "t3"].contains(&id.as_str()));
    }

    #[test]
    fn history_records_plays_recent_first() {
        let mut e = engine();
        e.play_track("t1").unwrap();
        e.play_track("t2").unwrap();
        e.play_track("t1").unwrap();
        assert_eq!(e.history_ids(), vec!["t1", "t2"]);
    }

    #[test]
    fn play_collection_replaces_queue() {
        let mut e = engine();
        e.play_collection("t4", vec!["t1".into(), "t4".into(), "t2".into()]).unwrap();
        assert_eq!(e.queue_ids(), vec!["t1", "t4", "t2"]);
        assert_eq!(e.playback.track_id.as_deref(), Some("t4"));
    }

    #[test]
    fn playlist_crud() {
        let mut e = engine();
        e.playlists.clear();
        let pl = e.create_playlist("Road Trip").unwrap();
        assert_eq!(pl.id, "pl1");
        assert_eq!(pl.name, "Road Trip");
        e.add_to_playlist(&pl.id, &["t1".into(), "t2".into()]).unwrap();
        assert_eq!(e.playlists[0].track_ids, vec!["t1", "t2"]);
        e.remove_from_playlist(&pl.id, "t1").unwrap();
        assert_eq!(e.playlists[0].track_ids, vec!["t2"]);
        e.rename_playlist(&pl.id, "Trip").unwrap();
        assert_eq!(e.playlists[0].name, "Trip");
        e.delete_playlist(&pl.id).unwrap();
        assert!(e.playlists.is_empty());
    }

    #[test]
    fn empty_playlist_name_rejected() {
        let mut e = engine();
        assert!(e.create_playlist("   ").is_err());
    }

    #[test]
    fn toggle_favorite_flips_flag() {
        let mut e = engine();
        assert!(e.toggle_favorite("t2").unwrap());
        assert!(e.library.iter().find(|t| t.id == "t2").unwrap().favorite);
    }

    #[test]
    fn seek_clamps_to_duration() {
        let mut e = engine();
        e.play_track("t1").unwrap(); // 238s
        let v = e.seek(9999.0);
        assert_eq!(v, 238.0);
        assert_eq!(e.playback.position_secs, 238.0);
    }
}
