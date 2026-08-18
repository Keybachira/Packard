use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime};
use tauri::async_runtime::JoinHandle;
use windows::core::{HSTRING, Interface, Result};
use windows::Media::*;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::WinRT::{self, ISystemMediaTransportControlsInterop, RoGetActivationFactory};
use crate::{persist_music, broadcast_remote, AppState};
use crate::music::MusicEngine;
use crate::playback::PlaybackEngine;
use crate::error::err;

// Helper to convert seconds to TimeSpan (100ns units)
fn secs_to_timespan(secs: f32) -> windows::Win32::Foundation::TimeSpan {
    windows::Win32::Foundation::TimeSpan {
        Duration: (secs * 10_000_000.0) as i64,
    }
}

/// Handles SystemMediaTransportControls for AVRCP in-band control.
pub struct MediaKeys {
    /// The SMTC instance, protected by a mutex for thread-safe access.
    inner: Mutex<Option<SystemMediaTransportControls>>,
    /// Last track ID for which we pushed metadata, to avoid redundant updates.
    last_metadata_track: Mutex<Option<String>>,
}

impl MediaKeys {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
            last_metadata_track: Mutex::new(None),
        }
    }

    /// Registers SMTC for the given window and starts the sync ticker.
    pub fn register(&self, app_handle: &AppHandle, hwnd: HWND) -> Result<()> {
        // Get the activation factory for SystemMediaTransportControlsInterop
        let factory: ISystemMediaTransportControlsInterop = unsafe {
            RoGetActivationFactory(&HSTRING::from("Windows.Media.SystemMediaTransportControlsInterop"))?
        };
        // Get the SMTC instance for this window
        let smtc: SystemMediaTransportControls = factory.GetForWindow(hwnd)?;

        // Enable SMTC and configure buttons
        smtc.SetIsEnabled(true)?;
        smtc.SetIsPlayEnabled(true)?;
        smtc.SetIsPauseEnabled(true)?;
        smtc.SetIsNextEnabled(true)?;
        smtc.SetIsPreviousEnabled(true)?;
        // Stop button optional; we enable it for completeness
        smtc.SetIsStopEnabled(true)?;

        // Set up the ButtonPressed event handler
        let handler = TypedEventHandler::<SystemMediaTransportControls, SystemMediaTransportControlsButtonPressedEventArgs>::new(
            {
                let app_handle = app_handle.clone();
                move |_sender, args| -> Result<()> {
                    // Get the button pressed
                    let button = args.Button()?;
                    // Get app state to drive the player
                    let state = app_handle.state::<AppState>();
                    let music_state = state.music.lock().map_err(err)?;

                    // Handle the button press
                    match button {
                        SystemMediaTransportControlsButton::Play => {
                            // If paused, resume; if stopped, start playing
                            if !music_state.playback.playing {
                                if let Some(track_id) = &music_state.playback.track_id {
                                    // Resume current track
                                    let _ = player_play_impl(state);
                                } else {
                                    // Start first track
                                    let _ = player_play_impl(state);
                                }
                            }
                        }
                        SystemMediaTransportControlsButton::Pause => {
                            // Pause if playing
                            if music_state.playback.playing {
                                let _ = player_pause_impl(state);
                            }
                        }
                        SystemMediaTransportControlsButton::Next => {
                            let _ = player_next_impl(state.app_handle().clone(), state)?;
                        }
                        SystemMediaTransportControlsButton::Previous => {
                            let _ = player_previous_impl(state.app_handle().clone(), state)?;
                        }
                        SystemMediaTransportControlsButton::Stop => {
                            // Stop playback
                            let mut music = state.music.lock().map_err(err)?;
                            music.playback.playing = false;
                            music.playback.position_secs = 0.0;
                            // Notify remote and persist
                            persist_music(&app_handle, &state);
                            broadcast_remote(&state);
                        }
                        _ => {}
                    }

                    // Persist state and broadcast to remotes
                    persist_music(&app_handle, &state);
                    broadcast_remote(&state);

                    // Update SMTC to reflect new state immediately
                    let _ = Self::sync_from(&state);
                    Ok(())
                }
            }
        );

        // Subscribe to ButtonPressed events
        smtc.ButtonPressed(&handler)?;

        // Store the SMTC instance and the handler (to keep it alive)
        *self.inner.lock().unwrap() = Some(smtc);
        // We could store the handler if needed, but keeping it in scope is enough for now.
        // For simplicity, we rely on the closure being captured by the SMTC subscription.

        // Initial sync
        let _ = Self::sync_from(&state);
        Ok(())
    }

    /// Synchronizes SMTC state with the current music engine state.
    pub fn sync_from(state: &AppState) -> Result<()> {
        // Lock the SMTC (we need to access it; it's Send+Sync so OK across threads)
        let smtc_guard = self.inner.lock().unwrap();
        let Some(smtc) = &*smtc_guard else {
            return Ok(());
        };

        // Get current music state
        let music_state = state.music.lock().map_err(err)?;
        let playback = &music_state.playback;
        let playing = playback.playing;
        let track_id_opt = playback.track_id.as_ref();

        // Update playback status
        let status = if playing {
            MediaPlaybackStatus::Playing
        } else {
            MediaPlaybackStatus::Stopped
        };
        smtc.SetPlaybackStatus(status)?;

        // If we have a track, update metadata and timeline
        if let Some(track_id) = track_id_opt {
            // Check if we need to update metadata (only if track changed)
            let mut last_track_guard = self.last_metadata_track.lock().unwrap();
            if Some(track_id) != last_track_guard.as_deref() {
                // Update metadata
                if let Ok(updater) = smtc.DisplayUpdater() {
                    updater.SetType(MediaPlaybackType::Music)?;
                    if let Ok(music_props) = updater.MusicProperties() {
                        // Get track from library
                        if let Some(track) = music_state.library.iter().find(|t| t.id == *track_id) {
                            let _ = music_props.SetTitle(&HSTRING::from(&track.title));
                            let _ = music_props.SetArtist(&HSTRING::from(&track.artist));
                            let _ = music_props.SetAlbumTitle(&HSTRING::from(&track.album));
                            let _ = music_props.SetAlbumArtist(&HSTRING::from(&track.artist));
                            // Genres optional; skip for now
                            // TrackNumber optional; skip for now
                        }
                    }
                    let _ = updater.Update();
                }
                *last_track_guard = Some(track_id.clone());
            }

            // Update timeline (position, duration)
            if let Ok(updater) = smtc.DisplayUpdater() {
                let mut timeline = SystemMediaTransportControlsTimelineProperties::new()?;
                timeline.SetStartTime(secs_to_timespan(0.0))?;
                timeline.SetEndTime(secs_to_timespan(track_id_opt.map_or(0.0, |id| {
                    music_state.library.iter()
                        .find(|t| t.id == id)
                        .map(|t| t.duration_secs)
                        .unwrap_or(0.0)
                })))?;
                timeline.SetPosition(secs_to_timespan(playback.position_secs))?;
                smtc.UpdateTimelineProperties(&timeline)?;
            }
        } else {
            // No track: clear metadata (optional) and set stopped
            let _ = self.last_metadata_track.lock().unwrap().take();
        }

        Ok(())
    }

    /// Starts a background ticker that periodically syncs SMTC state.
    pub fn start_ticker(app: AppHandle) -> JoinHandle<()> {
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            loop {
                interval.tick().await;
                let _ = MediaKeys::sync_from(&app.state::<AppState>());
            }
        })
    }
}

unsafe impl Send for MediaKeys {}
unsafe impl Sync for MediaKeys {}