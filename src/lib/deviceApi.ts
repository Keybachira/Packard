import { invoke } from "@tauri-apps/api/core";
import type {
  AppProfileBinding,
  AppSettings,
  AudioDevice,
  AudioLabParams,
  ConnectionType,
  DeviceSettings,
  HardwareCommand,
  HardwareDevice,
  HardwareDspStatus,
  OptimizationResult,
  PlaybackState,
  Playlist,
  Profile,
  RecognitionEntry,
  RecognitionResult,
  RemoteState,
  RoomProfile,
  SubwooferState,
  Track,
} from "../types/audio";

export async function listDevices(): Promise<AudioDevice[]> {
  return invoke<AudioDevice[]>("list_devices");
}

export async function connectDevice(
  id: string,
  connection: ConnectionType,
): Promise<AudioDevice> {
  return invoke<AudioDevice>("connect_device", { id, connection });
}

export async function getDeviceSettings(id: string): Promise<DeviceSettings> {
  return invoke<DeviceSettings>("get_device_settings", { deviceId: id });
}

export async function setVolume(
  deviceId: string,
  volume: number,
): Promise<void> {
  await invoke("set_volume", { deviceId, volume });
}

export async function setMute(deviceId: string, muted: boolean): Promise<void> {
  await invoke("set_mute", { deviceId, muted });
}

export async function setEq(deviceId: string, gains: number[]): Promise<void> {
  await invoke("set_eq", { deviceId, gains });
}

export async function applyPreset(
  deviceId: string,
  preset: string,
): Promise<void> {
  await invoke("apply_preset", { deviceId, preset });
}

export async function setSubwoofer(
  deviceId: string,
  state: SubwooferState,
): Promise<void> {
  await invoke("set_subwoofer", { deviceId, state });
}

export async function setAudioLab(
  deviceId: string,
  params: AudioLabParams,
): Promise<void> {
  await invoke("set_audio_lab", { deviceId, params });
}

export async function runCalibration(deviceId: string): Promise<RoomProfile> {
  return invoke<RoomProfile>("run_calibration", { deviceId });
}

/**
 * Measure the signal currently playing through the loopback tap and fold
 * safe adjustments into the Audio Lab chain (spectral flattening, clipping
 * protection, compressor/loudness). Resolves with the applied params plus
 * diagnostics.
 */
export async function runAudioOptimization(
  deviceId: string,
): Promise<OptimizationResult> {
  return invoke<OptimizationResult>("run_audio_optimization", { deviceId });
}

// --- Phase 08: hardware (USB/HID) -------------------------------------------

/** Enumerate USB devices exposed over HID. */
export async function listHardwareDevices(): Promise<HardwareDevice[]> {
  return invoke<HardwareDevice[]>("list_hardware_devices");
}

/**
 * Send a DSP command to a hardware device. A `status` command resolves with
 * the decoded device state; other commands resolve with `null` after the
 * report is written.
 */
export async function hardwareCommand(
  deviceId: string,
  command: HardwareCommand,
): Promise<HardwareDspStatus | null> {
  return invoke<HardwareDspStatus | null>("hardware_command", {
    deviceId,
    command,
  });
}

// --- Music engine ----------------------------------------------------------

export async function getLibrary(): Promise<Track[]> {
  return invoke<Track[]>("get_library");
}

export async function scanLibrary(paths: string[]): Promise<Track[]> {
  return invoke<Track[]>("scan_library", { paths });
}

export async function getPlaylists(): Promise<Playlist[]> {
  return invoke<Playlist[]>("get_playlists");
}

export async function getPlayback(): Promise<PlaybackState> {
  return invoke<PlaybackState>("get_playback");
}

export async function playerPlay(trackId: string): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_play", { trackId });
}

export async function playerTogglePause(): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_toggle_pause");
}

export async function playerNext(): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_next");
}

export async function playerPrevious(): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_previous");
}

export async function getQueue(): Promise<Track[]> {
  return invoke<Track[]>("get_queue");
}

export async function toggleFavorite(trackId: string): Promise<Track[]> {
  return invoke<Track[]>("toggle_favorite", { trackId });
}

export async function playerPlayCollection(
  trackId: string,
  ids: string[],
): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_play_collection", { trackId, ids });
}

export async function enqueueIds(trackIds: string[]): Promise<Track[]> {
  return invoke<Track[]>("enqueue_ids", { trackIds });
}

export async function enqueueNextIds(trackIds: string[]): Promise<Track[]> {
  return invoke<Track[]>("enqueue_next_ids", { trackIds });
}

export async function removeFromQueue(trackId: string): Promise<Track[]> {
  return invoke<Track[]>("remove_from_queue", { trackId });
}

export async function reorderQueue(from: number, to: number): Promise<Track[]> {
  return invoke<Track[]>("reorder_queue", { from, to });
}

export async function setQueue(trackIds: string[]): Promise<Track[]> {
  return invoke<Track[]>("set_queue", { trackIds });
}

export async function clearQueue(): Promise<Track[]> {
  return invoke<Track[]>("clear_queue");
}

export async function playerSetShuffle(shuffle: boolean): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_set_shuffle", { shuffle });
}

export async function playerSetRepeat(repeat: boolean): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_set_repeat", { repeat });
}

export async function playerSeek(positionSecs: number): Promise<PlaybackState> {
  return invoke<PlaybackState>("player_seek", { positionSecs });
}

// --- Playlists --------------------------------------------------------------

export async function createPlaylist(name: string): Promise<Playlist> {
  return invoke<Playlist>("create_playlist", { name });
}

export async function renamePlaylist(
  playlistId: string,
  name: string,
): Promise<Playlist> {
  return invoke<Playlist>("rename_playlist", { playlistId, name });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await invoke("delete_playlist", { playlistId });
}

export async function addToPlaylist(
  playlistId: string,
  trackIds: string[],
): Promise<Playlist> {
  return invoke<Playlist>("add_to_playlist", { playlistId, trackIds });
}

export async function removeFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<Playlist> {
  return invoke<Playlist>("remove_from_playlist", { playlistId, trackId });
}

// --- History ----------------------------------------------------------------

export async function getHistory(): Promise<Track[]> {
  return invoke<Track[]>("get_history");
}

export async function clearHistory(): Promise<void> {
  await invoke("clear_history");
}

// --- Album art --------------------------------------------------------------

export async function getTrackArt(trackId: string): Promise<string | null> {
  return invoke<string | null>("get_track_art", { trackId });
}

// --- Profiles --------------------------------------------------------------

export async function getProfiles(): Promise<Profile[]> {
  return invoke<Profile[]>("get_profiles");
}

export async function getAppProfileBindings(): Promise<AppProfileBinding[]> {
  return invoke<AppProfileBinding[]>("get_app_profile_bindings");
}

export async function getForegroundApp(): Promise<string> {
  return invoke<string>("get_foreground_app");
}

// --- Realtime --------------------------------------------------------------

export async function getSpectrum(): Promise<number[]> {
  return invoke<number[]>("get_spectrum");
}

export async function getWaveform(): Promise<number[]> {
  return invoke<number[]>("get_waveform");
}

export interface AnalyzerStatus {
  captureAlive: boolean;
  sampleRate: number;
  buffered: number;
  framesPushed: number;
  peak: number;
  rms: number;
  lufs: number;
  lastError: string | null;
}

export async function getAnalyzerStatus(): Promise<AnalyzerStatus> {
  return invoke<AnalyzerStatus>("get_analyzer_status");
}

export interface StereoField {
  correlation: number;
  balance: number;
  width: number;
  mono: boolean;
}

export async function getStereoField(): Promise<StereoField> {
  return invoke<StereoField>("get_stereo_field");
}

// --- Settings --------------------------------------------------------------

export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function setAppSettings(settings: AppSettings): Promise<void> {
  await invoke("set_settings", { settings });
}

// --- Window mode -------------------------------------------------------

export async function enterMiniMode(): Promise<void> {
  await invoke("enter_mini_mode");
}

export async function exitMiniMode(): Promise<void> {
  await invoke("exit_mini_mode");
}

// --- Window chrome -------------------------------------------------------

export async function windowMinimize(): Promise<void> {
  await invoke("window_minimize");
}

export async function windowToggleMaximize(): Promise<boolean> {
  return invoke<boolean>("window_toggle_maximize");
}

export async function windowIsMaximized(): Promise<boolean> {
  return invoke<boolean>("window_is_maximized");
}

export async function windowClose(): Promise<void> {
  await invoke("window_close");
}

// --- Music recognition ------------------------------------------------------

/** Record ~8s from the mic and identify the track against the local library. */
export async function recognizeFromMicrophone(): Promise<RecognitionResult> {
  return invoke<RecognitionResult>("recognize_from_microphone");
}

export async function getRecognitionHistory(): Promise<RecognitionEntry[]> {
  return invoke<RecognitionEntry[]>("get_recognition_history");
}

export async function clearRecognitionHistory(): Promise<void> {
  await invoke("clear_recognition_history");
}

/** Save the last mic clip as a WAV in the library folder and add it as a track. */
export async function addRecognizedToLibrary(title?: string): Promise<Track> {
  return invoke<Track>("add_recognized_to_library", { title: title ?? null });
}

// --- Remote control ----------------------------------------------------

export async function getRemoteState(): Promise<RemoteState> {
  return invoke<RemoteState>("get_remote_state");
}

export async function regenerateRemoteSession(): Promise<RemoteState> {
  return invoke<RemoteState>("regenerate_remote_session");
}

export async function disconnectAllRemotes(): Promise<RemoteState> {
  return invoke<RemoteState>("disconnect_all_remotes");
}

export async function disconnectRemote(remoteId: string): Promise<RemoteState> {
  return invoke<RemoteState>("disconnect_remote", { remoteId });
}
