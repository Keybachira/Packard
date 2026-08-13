import { invoke } from "@tauri-apps/api/core";
import type {
  AudioDevice,
  CalibrationResult,
  ConnectionType,
  DeviceSettings,
  PresetName,
  SubwooferState,
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

export async function applyPreset(deviceId: string, preset: PresetName): Promise<void> {
  await invoke("apply_preset", { deviceId, preset });
}

export async function setSubwoofer(deviceId: string, state: SubwooferState): Promise<void> {
  await invoke("set_subwoofer", { deviceId, state });
}

export async function runCalibration(deviceId: string): Promise<CalibrationResult> {
  return invoke<CalibrationResult>("run_calibration", { deviceId });
}

export async function getSpectrum(): Promise<number[]> {
  return invoke<number[]>("get_spectrum");
}