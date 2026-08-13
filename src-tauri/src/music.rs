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

/// Music Engine state.
pub struct MusicEngine {
    pub library: Vec<Track>,
    pub playlists: Vec<Playlist>,
    pub playback: PlaybackState,
    /// Index into a derived play queue.
    queue: Vec<String>,
    queue_index: usize,
}

impl MusicEngine {
    pub fn new() -> Self {
        Self {
            library: Vec::new(),
            playlists: Vec::new(),
            playback: PlaybackState::default(),
            queue: Vec::new(),
            queue_index: 0,
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

    pub fn play_track(&mut self, track_id: &str) -> Result<(), String> {
        if !self.library.iter().any(|t| t.id == track_id) {
            return Err(format!("unknown track '{track_id}'"));
        }
        self.playback.track_id = Some(track_id.to_string());
        self.playback.playing = true;
        self.playback.position_secs = 0.0;
        self.queue = self.library.iter().map(|t| t.id.clone()).collect();
        self.queue_index = self.queue.iter().position(|id| id == track_id).unwrap_or(0);
        Ok(())
    }

    pub fn toggle_pause(&mut self) {
        self.playback.playing = !self.playback.playing;
    }

    pub fn next(&mut self) {
        if self.queue.is_empty() {
            return;
        }
        self.queue_index = (self.queue_index + 1) % self.queue.len();
        let id = self.queue[self.queue_index].clone();
        self.playback.track_id = Some(id);
        self.playback.position_secs = 0.0;
        self.playback.playing = true;
    }

    pub fn previous(&mut self) {
        if self.queue.is_empty() {
            return;
        }
        self.queue_index = if self.queue_index == 0 {
            self.queue.len() - 1
        } else {
            self.queue_index - 1
        };
        let id = self.queue[self.queue_index].clone();
        self.playback.track_id = Some(id);
        self.playback.position_secs = 0.0;
        self.playback.playing = true;
    }

    /// Tracks currently in the play queue, resolved to full metadata.
    pub fn resolved_queue(&self) -> Vec<Track> {
        self.queue
            .iter()
            .filter_map(|id| self.library.iter().find(|t| t.id == *id))
            .cloned()
            .collect()
    }

    /// Fake playback progress; the real engine will tick from the audio
    /// device clock. Advance 1 second per call for demo purposes.
    #[allow(dead_code)]
    pub fn tick(&mut self) {
        if !self.playback.playing {
            return;
        }
        self.playback.position_secs += 1.0;
        if let Some(id) = &self.playback.track_id {
            if let Some(track) = self.library.iter().find(|t| &t.id == id) {
                if self.playback.position_secs >= track.duration_secs {
                    if self.playback.repeat {
                        self.playback.position_secs = 0.0;
                    } else {
                        self.next();
                    }
                }
            }
        }
    }
}

impl Default for MusicEngine {
    fn default() -> Self {
        Self::new()
    }
}
