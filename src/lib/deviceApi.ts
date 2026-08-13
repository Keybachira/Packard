import { invoke } from "@tauri-apps/api/core";
import type {
  AppProfileBinding,
  AppSettings,
  AudioDevice,
  AudioLabParams,
  ConnectionType,
  DeviceSettings,
  PlaybackState,
  Playlist,
  Profile,
  RoomProfile,
  SubwooferState,
  Track,
} from "../types/audio";

export async function listDevices(): Promise<AudioDevice[]> {
  return invoke<AudioDevice[]>("list_devices");
}

export async function connectDevice(id: string, connection: ConnectionType): Promise<AudioDevice> {
  return invoke<AudioDevice>("connect_device", { id, connection });
}

export async function getDeviceSettings(id: string): Promise<DeviceSettings> {
  return invoke<DeviceSettings>("get_device_settings", { deviceId: id });
}

export async function setVolume(deviceId: string, volume: number): Promise<void> {
  await invoke("set_volume", { deviceId, volume });
}

export async function setMute(deviceId: string, muted: boolean): Promise<void> {
  await invoke("set_mute", { deviceId, muted });
}

export async function setEq(deviceId: string, gains: number[]): Promise<void> {
  await invoke("set_eq", { deviceId, gains });
}

export async function applyPreset(deviceId: string, preset: string): Promise<void> {
  await invoke("apply_preset", { deviceId, preset });
}

export async function setSubwoofer(deviceId: string, state: SubwooferState): Promise<void> {
  await invoke("set_subwoofer", { deviceId, state });
}

export async function setAudioLab(deviceId: string, params: AudioLabParams): Promise<void> {
  await invoke("set_audio_lab", { deviceId, params });
}

export async function runCalibration(deviceId: string): Promise<RoomProfile> {
  return invoke<RoomProfile>("run_calibration", { deviceId });
}

// --- Music engine ----------------------------------------------------------

export async function getLibrary(): Promise<Track[]> {
  return invoke<Track[]>("get_library");
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

// --- Settings --------------------------------------------------------------

export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function setAppSettings(settings: AppSettings): Promise<void> {
  await invoke("set_settings", { settings });
}
