mod audio;
mod hardware;
mod music;
mod profiles;
mod settings;
mod windows;

use audio::equalizer::BAND_FREQUENCIES;
use audio::AudioLabParams;
use hardware::{AudioDevice, ConnectionType, DeviceSettings, SubwooferState};
use hardware::devices::DeviceRegistry;
use music::{MusicEngine, PlaybackState, Playlist, Track};
use profiles::{AppProfileBinding, Profile, RoomProfile};
use settings::AppSettings;
use std::sync::Mutex;
use tauri::State;

/// App-wide state shared across Tauri commands.
pub struct AppState {
    devices: Mutex<DeviceRegistry>,
    audio: Mutex<audio::DspEngine>,
    music: Mutex<MusicEngine>,
    /// Dummy spectrum bins fed to the UI until WASAPI capture is wired up.
    spectrum: Mutex<Vec<f32>>,
    /// Dummy waveform samples for the realtime analyzer.
    waveform: Mutex<Vec<f32>>,
}

impl Default for AppState {
    fn default() -> Self {
        let mut registry = DeviceRegistry::new();
        registry.seed_demo();

        let mut music = MusicEngine::new();
        music.seed_demo();

        Self {
            devices: Mutex::new(registry),
            audio: Mutex::new(audio::DspEngine::new(48_000)),
            music: Mutex::new(music),
            spectrum: Mutex::new(vec![0.0; 48]),
            waveform: Mutex::new(vec![0.0; 512]),
        }
    }
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn list_devices(state: State<AppState>) -> Vec<AudioDevice> {
    state.devices.lock().map_err(err).map(|d| d.list()).unwrap_or_default()
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
    let mut devices = state.devices.lock().map_err(err)?;
    let device = devices
        .get_mut(&device_id)
        .ok_or_else(|| format!("device '{device_id}' not found"))?;
    device.volume = volume.clamp(0.0, 100.0);
    Ok(())
}

#[tauri::command]
fn set_mute(state: State<AppState>, device_id: String, muted: bool) -> Result<(), String> {
    let mut devices = state.devices.lock().map_err(err)?;
    let device = devices
        .get_mut(&device_id)
        .ok_or_else(|| format!("device '{device_id}' not found"))?;
    device.muted = muted;
    Ok(())
}

#[tauri::command]
fn set_eq(state: State<AppState>, device_id: String, gains: Vec<f32>) -> Result<(), String> {
    let _ = device_id;
    let mut audio = state.audio.lock().map_err(err)?;
    audio.params.eq = gains.clone();
    audio.rebuild_eq();
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
    let mut audio = state.audio.lock().map_err(err)?;
    audio.apply_params(params);
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

#[tauri::command]
fn get_playlists(state: State<AppState>) -> Vec<Playlist> {
    state.music.lock().map_err(err).map(|m| m.playlists.clone()).unwrap_or_default()
}

#[tauri::command]
fn get_playback(state: State<AppState>) -> PlaybackState {
    state.music.lock().map_err(err).map(|m| m.playback.clone()).unwrap_or_default()
}

#[tauri::command]
fn player_play(state: State<AppState>, track_id: String) -> Result<PlaybackState, String> {
    let mut music = state.music.lock().map_err(err)?;
    music.play_track(&track_id)?;
    Ok(music.playback.clone())
}

#[tauri::command]
fn player_toggle_pause(state: State<AppState>) -> Result<PlaybackState, String> {
    let mut music = state.music.lock().map_err(err)?;
    music.toggle_pause();
    Ok(music.playback.clone())
}

#[tauri::command]
fn player_next(state: State<AppState>) -> Result<PlaybackState, String> {
    let mut music = state.music.lock().map_err(err)?;
    music.next();
    Ok(music.playback.clone())
}

#[tauri::command]
fn player_previous(state: State<AppState>) -> Result<PlaybackState, String> {
    let mut music = state.music.lock().map_err(err)?;
    music.previous();
    Ok(music.playback.clone())
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

/// Stub for the foreground-app detection. The real implementation enumerates
/// foreground windows (GetForegroundWindow + process name) and maps them to a
/// binding.
#[tauri::command]
fn get_foreground_app(_state: State<AppState>) -> String {
    "Spotify.exe".into()
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
        .manage(AppState::default())
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
