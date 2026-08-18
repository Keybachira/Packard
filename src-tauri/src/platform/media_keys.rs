//! SystemMediaTransportControls (SMTC) bridge.
//!
//! Registers the app with the Windows media session so the OS media overlay,
//! the keyboard media keys and — the reason this exists — AVRCP buttons on a
//! connected Bluetooth headset drive our player in-band. The same SMTC
//! instance also carries the now-playing metadata Windows shows on the flyout.

use std::time::Duration;

use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager};
use windows::core::{HSTRING, Ref, Result};
use windows::Foundation::{TimeSpan, TypedEventHandler};
use windows::Media::{
    MediaPlaybackStatus, MediaPlaybackType, SystemMediaTransportControls,
    SystemMediaTransportControlsButton, SystemMediaTransportControlsButtonPressedEventArgs,
    SystemMediaTransportControlsTimelineProperties,
};
use windows::Win32::Foundation::HWND;
use windows::Win32::System::WinRT::{ISystemMediaTransportControlsInterop, RoGetActivationFactory};

use crate::{
    broadcast_remote, persist_music, player_next_impl, player_pause_impl, player_play_impl,
    player_previous_impl, AppState,
};

/// Converts seconds to a WinRT `TimeSpan` (100ns units).
fn secs_to_timespan(secs: f32) -> TimeSpan {
    TimeSpan {
        Duration: (secs.max(0.0) as f64 * 10_000_000.0) as i64,
    }
}

/// Owns the SMTC instance and the metadata we last pushed to it.
///
/// Lives inside `AppState` behind a `Mutex`, so the fields need no interior
/// locking of their own. Lock order is always media_keys then music; never
/// hold the music lock while reaching for this one.
pub struct MediaKeys {
    controls: Option<SystemMediaTransportControls>,
    /// Track id whose metadata is currently on the flyout, so the ticker does
    /// not rewrite the display every second.
    last_metadata_track: Option<String>,
}

impl MediaKeys {
    pub fn new() -> Self {
        Self {
            controls: None,
            last_metadata_track: None,
        }
    }

    /// Attaches SMTC to `hwnd` and wires the transport buttons to the player.
    pub fn register(&mut self, app: &AppHandle, hwnd: HWND) -> Result<()> {
        let interop: ISystemMediaTransportControlsInterop = unsafe {
            RoGetActivationFactory(&HSTRING::from(
                "Windows.Media.SystemMediaTransportControls",
            ))?
        };
        let controls: SystemMediaTransportControls = unsafe { interop.GetForWindow(hwnd)? };

        controls.SetIsEnabled(true)?;
        controls.SetIsPlayEnabled(true)?;
        controls.SetIsPauseEnabled(true)?;
        controls.SetIsStopEnabled(true)?;
        controls.SetIsNextEnabled(true)?;
        controls.SetIsPreviousEnabled(true)?;

        let handler = TypedEventHandler::<
            SystemMediaTransportControls,
            SystemMediaTransportControlsButtonPressedEventArgs,
        >::new({
            let app = app.clone();
            move |_sender, args: Ref<SystemMediaTransportControlsButtonPressedEventArgs>| {
                let button = args.ok()?.Button()?;
                Self::handle_button(&app, button);
                Ok(())
            }
        });
        controls.ButtonPressed(&handler)?;

        self.controls = Some(controls);
        self.push_state(&app.state::<AppState>());
        Ok(())
    }

    /// Runs one transport button against the player.
    ///
    /// Deliberately holds no lock across the `player_*_impl` calls — those
    /// lock the music engine themselves, so keeping a guard here would
    /// deadlock.
    fn handle_button(app: &AppHandle, button: SystemMediaTransportControlsButton) {
        let state = app.state::<AppState>();

        let playing = match state.music.lock() {
            Ok(music) => music.playback.playing,
            Err(_) => return,
        };

        let result = if button == SystemMediaTransportControlsButton::Play {
            if playing {
                Ok(())
            } else {
                player_play_impl(&state)
            }
        } else if button == SystemMediaTransportControlsButton::Pause {
            if playing {
                player_pause_impl(&state)
            } else {
                Ok(())
            }
        } else if button == SystemMediaTransportControlsButton::Next {
            player_next_impl(&state)
        } else if button == SystemMediaTransportControlsButton::Previous {
            player_previous_impl(&state)
        } else if button == SystemMediaTransportControlsButton::Stop {
            let stopped = player_pause_impl(&state);
            if let Ok(mut music) = state.music.lock() {
                music.playback.position_secs = 0.0;
            }
            stopped
        } else {
            return;
        };

        if let Err(e) = result {
            eprintln!("media key: {e}");
            return;
        }

        persist_music(app, &state);
        broadcast_remote(&state);
        Self::sync(app);
    }

    /// Pushes the current player state onto the OS media session. Cheap enough
    /// to call every tick — metadata is only rewritten when the track changes.
    fn push_state(&mut self, state: &AppState) {
        let Some(controls) = self.controls.as_ref() else {
            return;
        };
        let Ok(music) = state.music.lock() else {
            return;
        };

        let status = if music.playback.playing {
            MediaPlaybackStatus::Playing
        } else if music.playback.track_id.is_some() {
            MediaPlaybackStatus::Paused
        } else {
            MediaPlaybackStatus::Stopped
        };
        let _ = controls.SetPlaybackStatus(status);

        let Some(track_id) = music.playback.track_id.clone() else {
            self.last_metadata_track = None;
            return;
        };
        let track = music.library.iter().find(|t| t.id == track_id);

        if self.last_metadata_track.as_deref() != Some(track_id.as_str()) {
            if let Ok(updater) = controls.DisplayUpdater() {
                let _ = updater.SetType(MediaPlaybackType::Music);
                if let (Ok(props), Some(track)) = (updater.MusicProperties(), track) {
                    let _ = props.SetTitle(&HSTRING::from(&track.title));
                    let _ = props.SetArtist(&HSTRING::from(&track.artist));
                    let _ = props.SetAlbumTitle(&HSTRING::from(&track.album));
                    let _ = props.SetAlbumArtist(&HSTRING::from(&track.artist));
                }
                let _ = updater.Update();
            }
            self.last_metadata_track = Some(track_id);
        }

        let duration = track.map(|t| t.duration_secs).unwrap_or(0.0);
        if let Ok(timeline) = SystemMediaTransportControlsTimelineProperties::new() {
            let _ = timeline.SetStartTime(secs_to_timespan(0.0));
            let _ = timeline.SetEndTime(secs_to_timespan(duration));
            let _ = timeline.SetPosition(secs_to_timespan(music.playback.position_secs));
            let _ = controls.UpdateTimelineProperties(&timeline);
        }
    }

    /// Syncs the OS media session from anywhere holding an `AppHandle`.
    pub fn sync(app: &AppHandle) {
        let state = app.state::<AppState>();
        if let Ok(mut keys) = state.media_keys.lock() {
            keys.push_state(&state);
        };
    }

    /// Keeps the flyout scrubber and play/pause glyph in step with playback.
    pub fn start_ticker(app: AppHandle) -> JoinHandle<()> {
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            loop {
                interval.tick().await;
                MediaKeys::sync(&app);
            }
        })
    }
}

impl Default for MediaKeys {
    fn default() -> Self {
        Self::new()
    }
}
