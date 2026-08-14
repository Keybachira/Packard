mod audio;
mod hardware;
mod library;
mod music;
mod platform;
mod playback;
mod profiles;
mod settings;

use audio::equalizer::BAND_FREQUENCIES;
use audio::AudioLabParams;
use hardware::{AudioDevice, ConnectionType, DeviceSettings, SubwooferState};
use hardware::devices::DeviceRegistry;
use music::{MusicEngine, PlaybackState, Playlist, Track};
use profiles::{AppProfileBinding, Profile, RoomProfile};
use settings::AppSettings;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

/// App-wide state shared across Tauri commands.
pub struct AppState {
    devices: Mutex<DeviceRegistry>,
    audio: Mutex<audio::DspEngine>,
    /// Live Audio Lab params consumed by the realtime playback thread.
    dsp: Arc<playback::SharedDsp>,
    music: Mutex<MusicEngine>,
    playback: Mutex<playback::PlaybackEngine>,
    /// Dummy spectrum bins fed to the UI until WASAPI capture is wired up.
    spectrum: Mutex<Vec<f32>>,
    /// Dummy waveform samples for the realtime analyzer.
    waveform: Mutex<Vec<f32>>,
}

impl Default for AppState {
    fn default() -> Self {
        let registry = DeviceRegistry::new();

        let mut music = MusicEngine::new();
        music.seed_demo();

        Self {
            devices: Mutex::new(registry),
            audio: Mutex::new(audio::DspEngine::new(48_000)),
            dsp: playback::SharedDsp::new(),
            music: Mutex::new(music),
            playback: Mutex::new(playback::PlaybackEngine::new()),
            spectrum: Mutex::new(vec![0.0; 48]),
            waveform: Mutex::new(vec![0.0; 512]),
        }
    }
}

/// Start (or restart) real playback for `track_id` if the library entry has
/// a real file path; a no-op for demo tracks without one.
fn play_track_file(state: &AppState, track_id: &str) {
    let path = {
        let music = match state.music.lock() {
            Ok(m) => m,
            Err(_) => return,
        };
        music.library.iter().find(|t| t.id == track_id).and_then(|t| t.path.clone())
    };
    if let Some(path) = path {
        if let Ok(mut engine) = state.playback.lock() {
            // Play through the OS default output device; per-endpoint
            // volume/mute is still controlled via WASAPI on the Devices page.
            if let Err(e) = engine.play_file(&path, state.dsp.clone(), None) {
                eprintln!("playback error: {e}");
            }
        }
    }
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn list_devices(state: State<AppState>) -> Vec<AudioDevice> {
    let live = platform::wasapi::Wasapi::new().enumerate_render_endpoints();
    let mut registry = match state.devices.lock() {
        Ok(g) => g,
        Err(_) => return live,
    };
    registry.sync_from(live);
    if registry.list().is_empty() {
        registry.seed_demo();
    }
    registry.list()
}

#[tauri::command]
fn connect_device(state: State<AppState>, id: String, _connection: ConnectionType) -> Result<AudioDevice, String> {
    let mut devices = state.devices.lock().map_err(err)?;
    let device = devices
        .get_mut(&id)
        .ok_or_else(|| format!("device '{id}' not found"))?;
    device.connected = true;
    Ok(device.clone())
}

#[tauri::command]
fn get_device_settings(state: State<AppState>, _device_id: String) -> DeviceSettings {
    let _ = state;
    DeviceSettings::default()
}

#[tauri::command]
fn set_volume(state: State<AppState>, device_id: String, volume: f32) -> Result<(), String> {
    let volume = volume.clamp(0.0, 100.0);
    platform::wasapi::Wasapi::new().set_endpoint_volume(&device_id, volume / 100.0)?;
    let mut devices = state.devices.lock().map_err(err)?;
    if let Some(device) = devices.get_mut(&device_id) {
        device.volume = volume;
    }
    Ok(())
}

#[tauri::command]
fn set_mute(state: State<AppState>, device_id: String, muted: bool) -> Result<(), String> {
    platform::wasapi::Wasapi::new().set_endpoint_mute(&device_id, muted)?;
    let mut devices = state.devices.lock().map_err(err)?;
    if let Some(device) = devices.get_mut(&device_id) {
        device.muted = muted;
    }
    Ok(())
}

#[tauri::command]
fn set_eq(state: State<AppState>, device_id: String, gains: Vec<f32>) -> Result<(), String> {
    let _ = device_id;
    {
        let mut audio = state.audio.lock().map_err(err)?;
        audio.params.eq = gains.clone();
        audio.rebuild_eq();
    }
    state.dsp.update(|p| p.eq = gains);
    Ok(())
}

#[tauri::command]
fn apply_preset(state: State<AppState>, device_id: String, preset: String) -> Result<(), String> {
    let gains: Vec<f32> = match preset.as_str() {
        "FLAT" => vec![0.0; BAND_FREQUENCIES.len()],
        "CINEMA" => vec![3.0, 4.0, 3.0, 1.0, -1.0, -1.0, 1.0, 2.0, 3.0, 3.0],
        "MUSIC" => vec![0.0, 1.0, 2.0, 3.0, 2.0, 0.0, -1.0, 0.0, 1.0, 2.0],
        "GAME" => vec![-2.0, 0.0, 2.0, 4.0, 5.0, 4.0, 3.0, 2.0, 1.0, 0.0],
        other => return Err(format!("unknown preset '{other}'")),
    };
    set_eq(state, device_id, gains)
}

#[tauri::command]
fn set_subwoofer(state: State<AppState>, _device_id: String, _state: SubwooferState) -> Result<(), String> {
    let _ = state;
    Ok(())
}

#[tauri::command]
fn set_audio_lab(state: State<AppState>, _device_id: String, params: AudioLabParams) -> Result<(), String> {
    {
        let mut audio = state.audio.lock().map_err(err)?;
        audio.apply_params(params.clone());
    }
    state.dsp.set(params);
    Ok(())
}

#[tauri::command]
fn run_calibration(state: State<AppState>, _device_id: String) -> Result<RoomProfile, String> {
    let _ = state;
    // Placeholder: the auto-calibration sweep would measure the room with the
    // device mic and return a generated EQ profile.
    let curve = vec![2.0, 3.0, 2.0, 0.0, -1.0, 0.0, 1.0, 2.0, 2.0, 1.0];
    Ok(RoomProfile {
        name: "Bedroom".into(),
        bass_resonance_hz: 82.0,
        correction_db: -3.2,
        stereo_imbalance_db: 1.4,
        curve,
    })
}

// --- Music engine ---------------------------------------------------------

#[tauri::command]
fn get_library(state: State<AppState>) -> Vec<Track> {
    state.music.lock().map_err(err).map(|m| m.library.clone()).unwrap_or_default()
}

/// Walk every configured library folder, read tags, and replace the current
/// library with the freshly scanned tracks (favorite flags are preserved by
/// track id across rescans).
#[tauri::command]
fn scan_library(state: State<AppState>, paths: Vec<String>) -> Vec<Track> {
    let mut tracks = library::scan_folders(&paths);
    let mut music = match state.music.lock() {
        Ok(g) => g,
        Err(_) => return tracks,
    };
    let favorites: std::collections::HashSet<String> = music
        .library
        .iter()
        .filter(|t| t.favorite)
        .map(|t| t.id.clone())
        .collect();
    for track in tracks.iter_mut() {
        track.favorite = favorites.contains(&track.id);
    }
    music.library = tracks.clone();
    music.playlists.clear();
    music.playback = PlaybackState::default();
    tracks
}

#[tauri::command]
fn get_playlists(state: State<AppState>) -> Vec<Playlist> {
    state.music.lock().map_err(err).map(|m| m.playlists.clone()).unwrap_or_default()
}

/// Whether the track currently pointed to by the queue has a real file on
/// disk backing it (as opposed to a demo/seeded entry with no path).
fn current_track_has_file(music: &MusicEngine) -> bool {
    music
        .playback
        .track_id
        .as_ref()
        .and_then(|id| music.library.iter().find(|t| &t.id == id))
        .is_some_and(|t| t.path.is_some())
}

#[tauri::command]
fn get_playback(state: State<AppState>) -> PlaybackState {
    let has_real_current = state.music.lock().map(|m| current_track_has_file(&m)).unwrap_or(false);

    // Auto-advance the queue once the currently playing real file finishes.
    // Only real (file-backed) tracks ever report `finished`, so demo entries
    // are never mistakenly skipped.
    if has_real_current {
        let finished = state.playback.lock().map(|p| p.finished()).unwrap_or(false);
        if finished {
            let mut music = match state.music.lock() {
                Ok(m) => m,
                Err(_) => return PlaybackState::default(),
            };
            if music.playback.playing {
                music.next();
                if let Some(id) = music.playback.track_id.clone() {
                    drop(music);
                    play_track_file(&state, &id);
                }
            }
        }
    }

    let mut playback = state.music.lock().map_err(err).map(|m| m.playback.clone()).unwrap_or_default();
    if has_real_current && playback.playing {
        if let Ok(engine) = state.playback.lock() {
            playback.position_secs = engine.position_secs();
        }
    }
    playback
}

#[tauri::command]
fn player_play(state: State<AppState>, track_id: String) -> Result<PlaybackState, String> {
    {
        let mut music = state.music.lock().map_err(err)?;
        music.play_track(&track_id)?;
    }
    play_track_file(&state, &track_id);
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

#[tauri::command]
fn player_toggle_pause(state: State<AppState>) -> Result<PlaybackState, String> {
    let mut music = state.music.lock().map_err(err)?;
    music.toggle_pause();
    if let Ok(engine) = state.playback.lock() {
        if music.playback.playing {
            engine.resume();
        } else {
            engine.pause();
        }
    }
    Ok(music.playback.clone())
}

#[tauri::command]
fn player_next(state: State<AppState>) -> Result<PlaybackState, String> {
    let track_id = {
        let mut music = state.music.lock().map_err(err)?;
        music.next();
        music.playback.track_id.clone()
    };
    if let Some(id) = track_id {
        play_track_file(&state, &id);
    }
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

#[tauri::command]
fn player_previous(state: State<AppState>) -> Result<PlaybackState, String> {
    let track_id = {
        let mut music = state.music.lock().map_err(err)?;
        music.previous();
        music.playback.track_id.clone()
    };
    if let Some(id) = track_id {
        play_track_file(&state, &id);
    }
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

#[tauri::command]
fn get_queue(state: State<AppState>) -> Vec<Track> {
    state.music.lock().map_err(err).map(|m| m.resolved_queue()).unwrap_or_default()
}

#[tauri::command]
fn toggle_favorite(state: State<AppState>, track_id: String) -> Result<Vec<Track>, String> {
    let mut music = state.music.lock().map_err(err)?;
    let track = music
        .library
        .iter_mut()
        .find(|t| t.id == track_id)
        .ok_or_else(|| format!("unknown track '{track_id}'"))?;
    track.favorite = !track.favorite;
    Ok(music.library.clone())
}

// --- Profiles -------------------------------------------------------------

#[tauri::command]
fn get_profiles(_state: State<AppState>) -> Vec<Profile> {
    Profile::seed()
}

#[tauri::command]
fn get_app_profile_bindings(_state: State<AppState>) -> Vec<AppProfileBinding> {
    AppProfileBinding::seed()
}

#[tauri::command]
fn get_foreground_app(_state: State<AppState>) -> String {
    platform::foreground::current_foreground_process_name().unwrap_or_default()
}

// --- Realtime analyzer -----------------------------------------------------

/// Realtime spectrum. Returns a smoothed demo signal until the WASAPI capture
/// loop feeds real FFT bins. Bins are 0.0..1.0, log-scaled.
#[tauri::command]
fn get_spectrum(state: State<AppState>) -> Vec<f32> {
    let mut guard = match state.spectrum.lock() {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };

    // Animate a smooth pseudo-random spectrum.
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as f32 / 1000.0)
        .unwrap_or(0.0);

    for (i, bin) in guard.iter_mut().enumerate() {
        let base = 0.05 + 0.35 * ((i as f32 / 4.0) - t * 1.3).sin().abs();
        let wobble = 0.15 * ((i as f32 / 2.0) + t * 2.1).sin();
        let target = (base + wobble).clamp(0.0, 1.0);
        *bin += (target - *bin) * 0.2;
    }

    guard.clone()
}

/// Realtime waveform samples (0.0..1.0) for the analyzer page.
#[tauri::command]
fn get_waveform(state: State<AppState>) -> Vec<f32> {
    let mut guard = match state.waveform.lock() {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as f32 / 1000.0)
        .unwrap_or(0.0);
    let n = guard.len();
    for (i, s) in guard.iter_mut().enumerate() {
        let phase = i as f32 / n as f32;
        let env = (phase * std::f32::consts::PI).sin();
        *s = env * (0.5 + 0.5 * (t * 2.4 + phase * 14.0).sin().abs()) * 0.5;
    }
    guard.clone()
}

// --- Settings -------------------------------------------------------------

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> AppSettings {
    AppSettings::load(&app)
}

#[tauri::command]
fn set_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    settings.save(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            // If the user already configured library folders in a previous
            // session, scan them right away instead of showing demo tracks.
            let settings = AppSettings::load(app.handle());
            if !settings.library_paths.is_empty() {
                let state = app.state::<AppState>();
                let tracks = library::scan_folders(&settings.library_paths);
                if !tracks.is_empty() {
                    if let Ok(mut music) = state.music.lock() {
                        music.library = tracks;
                        music.playlists.clear();
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            connect_device,
            get_device_settings,
            set_volume,
            set_mute,
            set_eq,
            apply_preset,
            set_subwoofer,
            set_audio_lab,
            run_calibration,
            get_library,
            scan_library,
            get_playlists,
            get_playback,
            player_play,
            player_toggle_pause,
            player_next,
            player_previous,
            get_queue,
            toggle_favorite,
            get_profiles,
            get_app_profile_bindings,
            get_foreground_app,
            get_spectrum,
            get_waveform,
            get_settings,
            set_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
