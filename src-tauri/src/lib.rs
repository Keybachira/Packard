mod audio;
mod hardware;
mod windows;

use audio::equalizer::BAND_FREQUENCIES;
use hardware::{AudioDevice, ConnectionType, DeviceSettings, SubwooferState};
use hardware::devices::DeviceRegistry;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// App-wide state shared across Tauri commands.
pub struct AppState {
    devices: Mutex<DeviceRegistry>,
    audio: Mutex<audio::DspEngine>,
    /// Dummy spectrum bins fed to the UI until WASAPI capture is wired up.
    spectrum: Mutex<Vec<f32>>,
}

impl Default for AppState {
    fn default() -> Self {
        let mut registry = DeviceRegistry::new();
        registry.seed_demo();

        Self {
            devices: Mutex::new(registry),
            audio: Mutex::new(audio::DspEngine::new(48_000)),
            spectrum: Mutex::new(vec![0.0; 48]),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalibrationResult {
    ok: bool,
    message: String,
    profile: Option<Vec<f32>>,
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
    let sample_rate = audio.sample_rate;
    audio.equalizer.set_gains(&gains, sample_rate);
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
fn run_calibration(state: State<AppState>, _device_id: String) -> Result<CalibrationResult, String> {
    let _ = state;
    // Placeholder: the auto-calibration sweep would measure the room with the
    // device mic and return a generated EQ profile.
    let profile = vec![2.0, 3.0, 2.0, 0.0, -1.0, 0.0, 1.0, 2.0, 2.0, 1.0];
    Ok(CalibrationResult {
        ok: true,
        message: "Calibration complete (demo profile applied).".into(),
        profile: Some(profile),
    })
}

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
            run_calibration,
            get_spectrum,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
