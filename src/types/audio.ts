export type ConnectionType =
  | "usb"
  | "bluetooth"
  | "hdmi"
  | "dac"
  | "headphones"
  | "microphone"
  | "audio_interface"
  | "none";

export interface AudioDevice {
  id: string;
  name: string;
  connection: ConnectionType;
  connected: boolean;
  volume: number;
  muted: boolean;
  supportsEq: boolean;
}

export interface EqBand {
  frequency: number;
  label: string;
  gain: number;
}

export interface SubwooferState {
  gain: number;
  frequency: number;
  phase: 0 | 180;
  enabled: boolean;
}

export type PresetName = "FLAT" | "CINEMA" | "MUSIC" | "GAME";

export interface Preset {
  name: PresetName;
  label: string;
  gains: number[];
}

export interface DeviceSettings {
  volume: number;
  muted: boolean;
  eq: number[];
  preset: PresetName;
  subwoofer: SubwooferState;
}

export interface CalibrationResult {
  ok: boolean;
  message: string;
  profile?: number[];
}

// --- Audio Lab -------------------------------------------------------------

export interface AudioLabParams {
  eq: number[];
  bass: number;
  treble: number;
  balance: number;
  loudness: boolean;
  compressor: boolean;
  limiter: boolean;
  noiseReduction: number;
  stereoWidth: number;
  spatial: boolean;
  crossfeed: number;
  gain: number;
  preamp: number;
}

// --- Music engine ----------------------------------------------------------

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  favorite: boolean;
  path: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
}

export interface PlaybackState {
  playing: boolean;
  trackId: string | null;
  positionSecs: number;
  shuffle: boolean;
  repeat: boolean;
}

// --- Profiles --------------------------------------------------------------

export interface Profile {
  id: string;
  name: string;
  category: string;
  bass: number;
  mids: number;
  treble: number;
  spatial: boolean;
  loudness: boolean;
  subwooferGain: number;
}

export interface AppProfileBinding {
  app: string;
  profileId: string;
  enabled: boolean;
}

export interface RoomProfile {
  name: string;
  bassResonanceHz: number;
  correctionDb: number;
  stereoImbalanceDb: number;
  curve: number[];
}

// --- App settings ----------------------------------------------------------

export interface AppSettings {
  theme: string;
  language: string;
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  notifications: boolean;
  checkUpdates: boolean;
  lastDeviceId: string | null;
  libraryPaths: string[];
  spectrumBins: number;
  profileAutoSwitch: boolean;
  onboarded: boolean;
  accent: string;
  username: string;
  /** Local profile photo as a data: URL. Never uploaded anywhere. */
  avatar: string;
}

// --- Notifications -----------------------------------------------------

export type ToastVariant = "info" | "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  time: number;
}

// --- Remote control ----------------------------------------------------

/// Mirrors `RemoteClientView` in `src-tauri/src/lib.rs`.
export interface RemoteClientInfo {
  id: string;
  connectedSecs: number;
}

/// Mirrors `RemoteStateView` in `src-tauri/src/remote/hub.rs` (via `lib.rs`).
export interface RemoteState {
  ready: boolean;
  lanIp: string | null;
  port: number | null;
  url: string | null;
  qrSvg: string | null;
  sessionExpiresIn: number;
  connectedCount: number;
  maxRemotes: number;
  clients: RemoteClientInfo[];
}

// --- Constants -------------------------------------------------------------

export const EQ_BANDS: EqBand[] = [
  { frequency: 32, label: "32Hz", gain: 0 },
  { frequency: 64, label: "64Hz", gain: 0 },
  { frequency: 125, label: "125Hz", gain: 0 },
  { frequency: 250, label: "250Hz", gain: 0 },
  { frequency: 500, label: "500Hz", gain: 0 },
  { frequency: 1000, label: "1K", gain: 0 },
  { frequency: 2000, label: "2K", gain: 0 },
  { frequency: 4000, label: "4K", gain: 0 },
  { frequency: 8000, label: "8K", gain: 0 },
  { frequency: 16000, label: "16K", gain: 0 },
];

export const PRESETS: Record<PresetName, number[]> = {
  FLAT: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  CINEMA: [3, 4, 3, 1, -1, -1, 1, 2, 3, 3],
  MUSIC: [0, 1, 2, 3, 2, 0, -1, 0, 1, 2],
  GAME: [-2, 0, 2, 4, 5, 4, 3, 2, 1, 0],
};

export function makePreset(name: PresetName): Preset {
  return {
    name,
    label: name.charAt(0) + name.slice(1).toLowerCase(),
    gains: PRESETS[name],
  };
}

export function defaultAudioLab(): AudioLabParams {
  return {
    eq: EQ_BANDS.map((b) => b.gain),
    bass: 0,
    treble: 0,
    balance: 0,
    loudness: false,
    compressor: false,
    limiter: true,
    noiseReduction: 0,
    stereoWidth: 100,
    spatial: false,
    crossfeed: 0,
    gain: 0,
    preamp: 0,
  };
}
