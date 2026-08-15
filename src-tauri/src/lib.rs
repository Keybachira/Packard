mod analyzer;
mod audio;
mod hardware;
mod library;
mod music;
mod platform;
mod playback;
mod profiles;
mod remote;
mod settings;

use analyzer::AudioTap;
use audio::equalizer::BAND_FREQUENCIES;
use audio::AudioLabParams;
use hardware::{AudioDevice, ConnectionType, DeviceSettings, SubwooferState};
use hardware::devices::DeviceRegistry;
use music::{MusicEngine, PlaybackState, Playlist, Track};
use platform::loopback::LoopbackCapture;
use profiles::{AppProfileBinding, Profile, RoomProfile};
use remote::hub::RemoteHub;
use remote::protocol::RemoteEvent;
use remote::snapshot;
use settings::AppSettings;
use std::sync::{Arc, Mutex};
use tauri::{Manager, PhysicalPosition, PhysicalSize, State, Window};

/// App-wide state shared across Tauri commands.
pub struct AppState {
    devices: Mutex<DeviceRegistry>,
    audio: Mutex<audio::DspEngine>,
    /// Live Audio Lab params consumed by the realtime playback thread.
    dsp: Arc<playback::SharedDsp>,
    music: Mutex<MusicEngine>,
    playback: Mutex<playback::PlaybackEngine>,
    /// Shared rolling tap of recently-played mono samples, fed by the WASAPI
    /// loopback capture thread and read by the realtime analyzer commands.
    tap: Arc<AudioTap>,
    /// Keeps the loopback capture thread alive for the app's lifetime.
    _capture: Option<LoopbackCapture>,
    /// Window position/size saved before entering mini (corner) mode, so it
    /// can be restored exactly when the user expands back to the full app.
    mini_geometry: Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>>,
    /// Remote-control pairing hub shared with the local axum server.
    remote: Arc<RemoteHub>,
}

impl Default for AppState {
    fn default() -> Self {
        let registry = DeviceRegistry::new();

        let mut music = MusicEngine::new();
        music.seed_demo();

        // Start capturing the default render endpoint in loopback mode so the
        // realtime analyzer reflects whatever audio the user is hearing.
        let tap = AudioTap::new();
        let capture = LoopbackCapture::start(tap.clone());

        Self {
            devices: Mutex::new(registry),
            audio: Mutex::new(audio::DspEngine::new(48_000)),
            dsp: playback::SharedDsp::new(),
            music: Mutex::new(music),
            playback: Mutex::new(playback::PlaybackEngine::new()),
            tap,
            _capture: Some(capture),
            mini_geometry: Mutex::new(None),
            remote: RemoteHub::new(),
        }
    }
}

/// Start (or restart) real playback for `track_id` if the library entry has
/// a real file path; a no-op for demo tracks without one.
pub(crate) fn play_track_file(state: &AppState, track_id: &str) {
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
    set_volume_impl(&state, &device_id, volume)?;
    broadcast_remote(&state);
    Ok(())
}

/// Shared by the Tauri command and the remote WebSocket handler. Writes the
/// endpoint volume via WASAPI and mirrors it in the device registry.
pub(crate) fn set_volume_impl(state: &AppState, device_id: &str, volume: f32) -> Result<(), String> {
    let volume = volume.clamp(0.0, 100.0);
    platform::wasapi::Wasapi::new().set_endpoint_volume(device_id, volume / 100.0)?;
    if let Ok(mut devices) = state.devices.lock() {
        if let Some(device) = devices.get_mut(device_id) {
            device.volume = volume;
        }
    }
    Ok(())
}

#[tauri::command]
fn set_mute(state: State<AppState>, device_id: String, muted: bool) -> Result<(), String> {
    set_mute_impl(&state, &device_id, muted)?;
    broadcast_remote(&state);
    Ok(())
}

/// Shared by the Tauri command and the remote WebSocket handler.
pub(crate) fn set_mute_impl(state: &AppState, device_id: &str, muted: bool) -> Result<(), String> {
    platform::wasapi::Wasapi::new().set_endpoint_mute(device_id, muted)?;
    if let Ok(mut devices) = state.devices.lock() {
        if let Some(device) = devices.get_mut(device_id) {
            device.muted = muted;
        }
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
pub(crate) fn current_track_has_file(music: &MusicEngine) -> bool {
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
    player_play_track_impl(&state, &track_id)?;
    broadcast_remote(&state);
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

/// Desktop path: start a specific track from the library.
pub(crate) fn player_play_track_impl(state: &AppState, track_id: &str) -> Result<(), String> {
    {
        let mut music = state.music.lock().map_err(err)?;
        music.play_track(track_id)?;
    }
    play_track_file(state, track_id);
    Ok(())
}

/// Remote path: `cmd.player.play` carries no id, so resume the current track
/// or start the first library track when nothing is loaded yet.
pub(crate) fn player_play_impl(state: &AppState) -> Result<(), String> {
    let track_id = {
        let mut music = state.music.lock().map_err(err)?;
        if let Some(id) = music.playback.track_id.clone() {
            if music.playback.playing {
                None
            } else {
                music.playback.playing = true;
                Some(id)
            }
        } else {
            let id = music.library.first().map(|t| t.id.clone());
            if let Some(id) = id {
                music.play_track(&id)?;
                Some(id)
            } else {
                None
            }
        }
    };
    if let Some(id) = track_id {
        if let Ok(engine) = state.playback.lock() {
            if engine.is_paused() {
                engine.resume();
                return Ok(());
            }
        }
        play_track_file(state, &id);
    }
    Ok(())
}

#[tauri::command]
fn player_toggle_pause(state: State<AppState>) -> Result<PlaybackState, String> {
    player_toggle_pause_impl(&state)?;
    broadcast_remote(&state);
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

/// Shared by the desktop toggle and the remote play/pause handling.
pub(crate) fn player_toggle_pause_impl(state: &AppState) -> Result<(), String> {
    let mut music = state.music.lock().map_err(err)?;
    music.toggle_pause();
    if let Ok(engine) = state.playback.lock() {
        if music.playback.playing {
            engine.resume();
        } else {
            engine.pause();
        }
    }
    Ok(())
}

/// Remote `cmd.player.pause` — only ever pauses.
pub(crate) fn player_pause_impl(state: &AppState) -> Result<(), String> {
    let mut music = state.music.lock().map_err(err)?;
    if music.playback.playing {
        music.playback.playing = false;
    }
    if let Ok(engine) = state.playback.lock() {
        engine.pause();
    }
    Ok(())
}

#[tauri::command]
fn player_next(state: State<AppState>) -> Result<PlaybackState, String> {
    player_next_impl(&state)?;
    broadcast_remote(&state);
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

/// Shared by the desktop command and the remote handler.
pub(crate) fn player_next_impl(state: &AppState) -> Result<(), String> {
    let track_id = {
        let mut music = state.music.lock().map_err(err)?;
        music.next();
        music.playback.track_id.clone()
    };
    if let Some(id) = track_id {
        play_track_file(state, &id);
    }
    Ok(())
}

#[tauri::command]
fn player_previous(state: State<AppState>) -> Result<PlaybackState, String> {
    player_previous_impl(&state)?;
    broadcast_remote(&state);
    state.music.lock().map_err(err).map(|m| m.playback.clone())
}

/// Shared by the desktop command and the remote handler.
pub(crate) fn player_previous_impl(state: &AppState) -> Result<(), String> {
    let track_id = {
        let mut music = state.music.lock().map_err(err)?;
        music.previous();
        music.playback.track_id.clone()
    };
    if let Some(id) = track_id {
        play_track_file(state, &id);
    }
    Ok(())
}

/// Push a fresh `state.snapshot` to every connected remote after any state
/// mutation on either side (desktop command or phone command).
pub(crate) fn broadcast_remote(state: &AppState) {
    let snapshot = snapshot::snapshot_state(state);
    state.remote.broadcast(RemoteEvent::StateSnapshot { state: snapshot });
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

// --- Remote control ---------------------------------------------------------

/// Everything the desktop "Controle Remoto" page needs to render: readiness,
/// LAN URL, emerald SVG QR, session expiry and connected remote count.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteStateView {
    ready: bool,
    lan_ip: Option<String>,
    port: Option<u16>,
    url: Option<String>,
    qr_svg: Option<String>,
    session_expires_in: u64,
    connected_count: usize,
    max_remotes: usize,
}

fn remote_state_view(state: &AppState) -> RemoteStateView {
    let hub = &state.remote;
    let session = hub.session();
    let lan_ip = remote::lanip::lan_ip();
    let port = hub.port();
    let ready = lan_ip.is_some() && port.is_some();
    let url = match (&lan_ip, port) {
        (Some(ip), Some(p)) => Some(format!("http://{ip}:{p}/remote?t={}", session.token)),
        _ => None,
    };
    let qr_svg = url
        .as_ref()
        .map(|u| remote::session::qr_svg(u))
        .filter(|svg| !svg.is_empty());
    RemoteStateView {
        ready,
        lan_ip,
        port,
        url,
        qr_svg,
        session_expires_in: session.time_remaining().as_secs(),
        connected_count: hub.connected_ids().len(),
        max_remotes: hub.max_remotes(),
    }
}

#[tauri::command]
fn get_remote_state(state: State<AppState>) -> RemoteStateView {
    remote_state_view(&state)
}

#[tauri::command]
fn regenerate_remote_session(state: State<AppState>) -> RemoteStateView {
    state.remote.regenerate();
    remote_state_view(&state)
}

#[tauri::command]
fn disconnect_all_remotes(state: State<AppState>) -> RemoteStateView {
    state.remote.disconnect_all();
    remote_state_view(&state)
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
//
// `get_spectrum` / `get_waveform` run a windowed FFT over the WASAPI loopback
// capture of the default render endpoint (see `platform::loopback`), so the
// analyzer reflects whatever audio is actually playing on the system.

/// Realtime spectrum of the audio currently being played system-wide. Bins
/// are 0.0..1.0, log-scaled.
#[tauri::command]
fn get_spectrum(state: State<AppState>) -> Vec<f32> {
    let sr = state.tap.sample_rate();
    analyzer::spectrum_bins(&state.tap, 48, sr).unwrap_or_else(|| vec![0.0; 48])
}

/// Realtime waveform samples (0.0..1.0) of the captured audio for the
/// analyzer page.
#[tauri::command]
fn get_waveform(state: State<AppState>) -> Vec<f32> {
    analyzer::waveform_samples(&state.tap, 512).unwrap_or_else(|| vec![0.5; 512])
}

/// Diagnostics for the analyzer, so the UI can show whether the WASAPI
/// loopback capture is actually delivering audio (and how loud it is).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyzerStatus {
    capture_alive: bool,
    sample_rate: u32,
    buffered: usize,
    frames_pushed: u64,
    peak: f32,
    rms: f32,
    lufs: f32,
    last_error: Option<String>,
}

#[tauri::command]
fn get_analyzer_status(state: State<AppState>) -> AnalyzerStatus {
    let window = (state.tap.sample_rate() as usize * 3 / 5).max(4096);
    let (peak, rms, lufs) = analyzer::levels(&state.tap, window);
    AnalyzerStatus {
        capture_alive: state._capture.is_some(),
        sample_rate: state.tap.sample_rate(),
        buffered: state.tap.len(),
        frames_pushed: state.tap.frames_pushed(),
        peak,
        rms,
        lufs,
        last_error: state._capture.as_ref().and_then(|c| c.last_error()),
    }
}

// --- Mini (corner) window mode ---------------------------------------------

/// Compact floating player size, matching the corner widget FLB.Music docks
/// to the bottom-right of the screen when minimized.
const MINI_WIDTH: u32 = 300;
const MINI_HEIGHT: u32 = 132;
const MINI_MARGIN: i32 = 22;
const DEFAULT_WIDTH: u32 = 1100;
const DEFAULT_HEIGHT: u32 = 780;

#[tauri::command]
fn enter_mini_mode(window: Window, state: State<AppState>) -> Result<(), String> {
    // Remember the current geometry so exit_mini_mode can restore it exactly.
    let pos = window.outer_position().map_err(err)?;
    let size = window.outer_size().map_err(err)?;
    if let Ok(mut geo) = state.mini_geometry.lock() {
        *geo = Some((pos, size));
    }

    let monitor = window
        .primary_monitor()
        .map_err(err)?
        .or(window.current_monitor().map_err(err)?)
        .ok_or_else(|| "no monitor available".to_string())?;
    let m_size = *monitor.size();
    let m_pos = *monitor.position();

    let target_pos = PhysicalPosition::new(
        m_pos.x + m_size.width as i32 - MINI_WIDTH as i32 - MINI_MARGIN,
        m_pos.y + m_size.height as i32 - MINI_HEIGHT as i32 - MINI_MARGIN,
    );

    window.set_resizable(false).map_err(err)?;
    window.set_size(PhysicalSize::new(MINI_WIDTH, MINI_HEIGHT)).map_err(err)?;
    window.set_position(target_pos).map_err(err)?;
    window.set_always_on_top(true).map_err(err)?;
    Ok(())
}

#[tauri::command]
fn exit_mini_mode(window: Window, state: State<AppState>) -> Result<(), String> {
    window.set_always_on_top(false).map_err(err)?;

    let restore = state.mini_geometry.lock().ok().and_then(|mut g| g.take());
    match restore {
        Some((pos, size)) => {
            window.set_size(size).map_err(err)?;
            window.set_position(pos).map_err(err)?;
        }
        None => {
            window
                .set_size(PhysicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT))
                .map_err(err)?;
        }
    }
    window.set_resizable(true).map_err(err)?;
    Ok(())
}

// --- Window chrome ----------------------------------------------------------
// The app runs undecorated (see tauri.conf.json) with its own title bar in
// the frontend, so these back the minimize/maximize/close buttons directly.

#[tauri::command]
fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(err)
}

#[tauri::command]
fn window_toggle_maximize(window: Window) -> Result<bool, String> {
    let maximized = window.is_maximized().map_err(err)?;
    if maximized {
        window.unmaximize().map_err(err)?;
    } else {
        window.maximize().map_err(err)?;
    }
    Ok(!maximized)
}

#[tauri::command]
fn window_is_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(err)
}

#[tauri::command]
fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(err)
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

            // Bring up the remote-control server (QR pairing + WebSocket) and
            // the 1s position ticker. Failures only log — the app keeps going.
            if let Err(e) = remote::server::start(app.handle()) {
                eprintln!("remote server: {e}");
            }
            remote::server::start_position_ticker(app.handle().clone());

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
            get_analyzer_status,
            get_settings,
            set_settings,
            enter_mini_mode,
            exit_mini_mode,
            window_minimize,
            window_toggle_maximize,
            window_is_maximized,
            window_close,
            get_remote_state,
            regenerate_remote_session,
            disconnect_all_remotes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
