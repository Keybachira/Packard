import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import DeviceManager from "./components/DeviceManager";
import Equalizer from "./components/Equalizer";
import PresetBar from "./components/PresetBar";
import SpectrumAnalyzer from "./components/SpectrumAnalyzer";
import SubwooferControls from "./components/SubwooferControls";
import {
  applyPreset,
  connectDevice,
  getDeviceSettings,
  listDevices,
  runCalibration,
  setEq,
  setMute,
  setSubwoofer,
  setVolume,
} from "./lib/deviceApi";
import type {
  AudioDevice,
  ConnectionType,
  DeviceSettings,
  PresetName,
  SubwooferState,
} from "./types/audio";
import { EQ_BANDS } from "./types/audio";

const DEFAULT_SETTINGS: DeviceSettings = {
  volume: 72,
  muted: false,
  eq: EQ_BANDS.map((b) => b.gain),
  preset: "FLAT",
  subwoofer: { gain: 0, frequency: 80, phase: 0, enabled: true },
};

export default function App() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<DeviceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spectrumOn, setSpectrumOn] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  const refreshDevices = useCallback(async () => {
    try {
      const list = await listDevices();
      setDevices(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      setStatus(`Error listing devices: ${e}`);
    }
  }, [selectedId]);

  useEffect(() => {
    refreshDevices().finally(() => setLoading(false));
  }, [refreshDevices]);

  useEffect(() => {
    if (!selectedId) return;
    getDeviceSettings(selectedId)
      .then((s) => setSettings(s))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, [selectedId]);

  const patchSettings = (patch: Partial<DeviceSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  const selectDevice = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setBusy(true);
      try {
        const conn: ConnectionType = "usb";
        const updated = await connectDevice(id, conn);
        setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      } catch (e) {
        setStatus(`Connect failed: ${e}`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onVolume = async (volume: number) => {
    patchSettings({ volume });
    if (selectedId) {
      try {
        await setVolume(selectedId, volume);
      } catch (e) {
        setStatus(`Volume failed: ${e}`);
      }
    }
  };

  const onMute = async (muted: boolean) => {
    patchSettings({ muted });
    if (selectedId) {
      try {
        await setMute(selectedId, muted);
      } catch (e) {
        setStatus(`Mute failed: ${e}`);
      }
    }
  };

  const onEq = async (gains: number[]) => {
    patchSettings({ eq: gains, preset: "FLAT" });
    if (selectedId) {
      try {
        await setEq(selectedId, gains);
      } catch (e) {
        setStatus(`EQ failed: ${e}`);
      }
    }
  };

  const onPreset = async (preset: PresetName) => {
    patchSettings({ preset, eq: preset === "FLAT" ? EQ_BANDS.map(() => 0) : settings.eq });
    if (selectedId) {
      try {
        await applyPreset(selectedId, preset);
      } catch (e) {
        setStatus(`Preset failed: ${e}`);
      }
    }
  };

  const onSubwoofer = async (subwoofer: SubwooferState) => {
    patchSettings({ subwoofer });
    if (selectedId) {
      try {
        await setSubwoofer(selectedId, subwoofer);
      } catch (e) {
        setStatus(`Subwoofer failed: ${e}`);
      }
    }
  };

  const calibrate = async () => {
    if (!selectedId) return;
    setCalibrating(true);
    try {
      const result = await runCalibration(selectedId);
      setStatus(result.message);
      if (result.profile) patchSettings({ eq: result.profile });
    } catch (e) {
      setStatus(`Calibration failed: ${e}`);
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            SOUND<span className="text-accent">CORE</span>
          </h1>
          <p className="text-xs text-text-dim">
            {selected
              ? `${selected.name} · ${selected.connection.toUpperCase()}`
              : "No device selected"}
          </p>
        </div>
        <button
          onClick={calibrate}
          disabled={!selectedId || calibrating || busy}
          className="rounded-lg border border-accent px-4 py-2 text-xs font-semibold tracking-widest text-accent transition-colors hover:bg-accent hover:text-black"
        >
          {calibrating ? "CALIBRATING…" : "AUTO CALIBRATE"}
        </button>
      </header>

      {status && (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          {status}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-dim">Scanning for devices…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-6">
            <DeviceManager
              devices={devices}
              selectedId={selectedId}
              onSelect={selectDevice}
              onRefresh={refreshDevices}
              disabled={busy}
            />

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-widest text-text-dim">MASTER</h2>
                <span className="font-mono text-xs text-text">{settings.volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.muted ? 0 : settings.volume}
                disabled={!selectedId}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="w-full"
              />
              <button
                onClick={() => onMute(!settings.muted)}
                disabled={!selectedId}
                className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-1 text-[10px] font-semibold tracking-widest text-text-dim transition-colors hover:text-text"
              >
                {settings.muted ? "UNMUTE" : "MUTE"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <PresetBar
                active={settings.preset}
                onSelect={onPreset}
                disabled={!selectedId}
              />
              <button
                onClick={() => setSpectrumOn((v) => !v)}
                className={`rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest transition-colors ${
                  spectrumOn
                    ? "border-accent text-accent"
                    : "border-border bg-surface-2 text-text-dim hover:text-text"
                }`}
              >
                SPECTRUM {spectrumOn ? "ON" : "OFF"}
              </button>
            </div>

            {spectrumOn && <SpectrumAnalyzer running={spectrumOn} />}

            <Equalizer gains={settings.eq} onChange={onEq} disabled={!selectedId} />

            <SubwooferControls
              state={settings.subwoofer}
              onChange={onSubwoofer}
              disabled={!selectedId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
