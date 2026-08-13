export type ConnectionType = "usb" | "bluetooth" | "none";

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