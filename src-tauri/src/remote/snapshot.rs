use crate::remote::protocol::{RemoteDevice, RemoteDeviceInfo, RemoteEq, RemotePlayback, SoundCoreState};
use crate::AppState;

/// The device a remote should control: the connected one, falling back to the
/// first known device so demo state still has a target.
pub fn active_device_id(state: &AppState) -> Option<String> {
    state.devices.lock().ok().and_then(|d| {
        let list = d.list();
        list.iter()
            .find(|dev| dev.connected)
            .or_else(|| list.first())
            .map(|dev| dev.id.clone())
    })
}

pub fn volume_of(state: &AppState, device_id: &str) -> f32 {
    state
        .devices
        .lock()
        .ok()
        .and_then(|d| d.get(device_id).map(|dev| dev.volume))
        .unwrap_or(0.0)
}

/// Build the `playback` slice of a snapshot from the music engine, overriding
/// the position with the real audio clock when a real file is playing.
pub fn playback_remote(state: &AppState) -> RemotePlayback {
    let has_real = state
        .music
        .lock()
        .map(|m| crate::current_track_has_file(&m))
        .unwrap_or(false);
    let mut playback = build_playback(state);
    if has_real && playback.playing {
        if let Ok(engine) = state.playback.lock() {
            playback.position_secs = engine.position_secs();
        }
    }
    playback
}

/// Full minimal state pushed to remotes on connect, on demand, and after any
/// mutation on either side.
pub fn snapshot_state(state: &AppState) -> SoundCoreState {
    let devices = state.devices.lock().ok();
    let list = devices.as_ref().map(|d| d.list()).unwrap_or_default();
    let active = list
        .iter()
        .find(|dev| dev.connected)
        .or_else(|| list.first());

    let device = active.map(|dev| RemoteDevice {
        id: dev.id.clone(),
        name: dev.name.clone(),
        connected: dev.connected,
    });

    let (volume, muted) = match active {
        Some(dev) => match devices.as_ref().and_then(|d| d.get(&dev.id)) {
            Some(found) => (found.volume, found.muted),
            None => (0.0, false),
        },
        None => (0.0, false),
    };

    let eq = match active {
        Some(dev) => eq_remote(state, dev),
        None => RemoteEq {
            gains: vec![0.0; crate::audio::equalizer::BAND_FREQUENCIES.len()],
            preset: "FLAT".into(),
            supports_eq: false,
        },
    };

    let devices = list
        .iter()
        .map(|dev| RemoteDeviceInfo {
            id: dev.id.clone(),
            name: dev.name.clone(),
            connection: dev.connection.to_string(),
            connected: dev.connected,
            active: active.map(|a| a.id == dev.id).unwrap_or(false),
        })
        .collect();

    SoundCoreState {
        device,
        volume,
        muted,
        playback: build_playback(state),
        active_profile: None,
        eq,
        devices,
    }
}

/// EQ gains + preset for the given (active) device, from the per-device
/// settings store so the phone sees exactly what the DSP is running.
fn eq_remote(state: &AppState, device: &crate::hardware::AudioDevice) -> RemoteEq {
    let settings = state
        .device_settings
        .lock()
        .ok()
        .and_then(|m| m.get(&device.id).cloned())
        .unwrap_or_default();
    RemoteEq {
        gains: settings.eq,
        preset: settings.preset,
        supports_eq: device.supports_eq,
    }
}

fn build_playback(state: &AppState) -> RemotePlayback {
    let mut playing = false;
    let mut title = None;
    let mut artist = None;
    let mut album = None;
    let mut position_secs = 0.0;
    let mut duration_secs = 0.0;

    if let Ok(music) = state.music.lock() {
        playing = music.playback.playing;
        position_secs = music.playback.position_secs;
        if let Some(track_id) = &music.playback.track_id {
            if let Some(track) = music.library.iter().find(|t| &t.id == track_id) {
                title = Some(track.title.clone());
                artist = Some(track.artist.clone());
                album = Some(track.album.clone());
                duration_secs = track.duration_secs;
            }
        }
    }

    RemotePlayback {
        playing,
        title,
        artist,
        album,
        position_secs,
        duration_secs,
    }
}
