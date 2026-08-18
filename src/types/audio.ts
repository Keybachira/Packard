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
  /** True when this is the OS's current default endpoint for its data flow. */
  isDefault: boolean;
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

/// Result of the one-shot "Audio optimization" pass. Mirrors
/// `OptimizationResult` in `src-tauri/src/audio/optimize.rs`.
export interface OptimizationResult {
  params: AudioLabParams;
  /** Per-band EQ delta introduced by the flattening pass (0 = untouched). */
  appliedEq: number[];
  clippingProtection: boolean;
  loudnessEnabled: boolean;
  compressorEnabled: boolean;
  measuredLufs: number;
  measuredPeak: number;
  notes: string[];
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

// --- Music recognition ------------------------------------------------------

/// Mirrors `RecognitionEntry` in `src-tauri/src/recognition.rs`.
export interface RecognitionEntry {
  id: string;
  timestampMs: number;
  matchedTrackId: string | null;
  title: string | null;
  artist: string | null;
  confidence: number;
}

/// Mirrors `RecognitionResult` in `src-tauri/src/lib.rs`.
export interface RecognitionResult {
  matched: boolean;
  track: Track | null;
  confidence: number;
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

// --- Phase 08: hardware (USB/HID) ------------------------------------------

export type HardwarePreset = "flat" | "cinema" | "music" | "game";

/** Mirror of the Rust `hardware::protocol::SubwooferState` wire fields. */
export interface HardwareSubwoofer {
  gain: number;
  frequency: number;
  phase: number;
  enabled: boolean;
}

/** Command accepted by `hardware_command`; adjacent-tagged in Rust. */
export type HardwareCommand =
  | { type: "power"; value: boolean }
  | { type: "volume"; value: number }
  | { type: "mute"; value: boolean }
  | { type: "eq"; value: number[] }
  | { type: "preset"; value: HardwarePreset }
  | { type: "subwoofer"; value: HardwareSubwoofer }
  | { type: "status" };

/** Device DSP state decoded from a status report. */
export interface HardwareDspStatus {
  power: boolean;
  volume: number;
  muted: boolean;
  eq: number[];
  preset: HardwarePreset;
  subwoofer: HardwareSubwoofer;
}

/** A USB device discovered over HID (`list_hardware_devices`). */
export interface HardwareDevice {
  id: string;
  name: string;
  vendorId: number;
  productId: number;
  usagePage: number;
  usage: number;
  interfaceNumber: number;
  productString: string | null;
  manufacturerString: string | null;
  serialNumber: string | null;
}
