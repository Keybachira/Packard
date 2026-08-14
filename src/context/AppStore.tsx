import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "../lib/deviceApi";
import type {
  AppProfileBinding,
  AppSettings,
  AudioDevice,
  AudioLabParams,
  DeviceSettings,
  PlaybackState,
  Playlist,
  Profile,
  RoomProfile,
  Track,
} from "../types/audio";
import { defaultAudioLab, EQ_BANDS } from "../types/audio";

export type SectionId =
  | "home"
  | "player"
  | "library"
  | "audioLab"
  | "calibration"
  | "devices"
  | "analyzer"
  | "profiles"
  | "appProfiles"
  | "settings";

const DEFAULT_SETTINGS: DeviceSettings = {
  volume: 72,
  muted: false,
  eq: EQ_BANDS.map((b) => b.gain),
  preset: "FLAT",
  subwoofer: { gain: 0, frequency: 80, phase: 0, enabled: true },
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "dark",
  language: "en",
  launchOnStartup: false,
  minimizeToTray: true,
  notifications: true,
  checkUpdates: true,
  lastDeviceId: null,
  libraryPaths: [],
  spectrumBins: 48,
  profileAutoSwitch: false,
};

interface AppStore {
  section: SectionId;
  setSection: (s: SectionId) => void;

  devices: AudioDevice[];
  selectedId: string | null;
  selected: AudioDevice | null;
  deviceSettings: DeviceSettings;
  loading: boolean;
  busy: boolean;
  status: string | null;
  notify: (msg: string) => void;

  refreshDevices: () => Promise<void>;
  selectDevice: (id: string) => Promise<void>;
  onVolume: (volume: number) => Promise<void>;
  onMute: (muted: boolean) => Promise<void>;
  onEq: (gains: number[]) => Promise<void>;
  onPreset: (preset: string) => Promise<void>;
  onSubwoofer: (sub: DeviceSettings["subwoofer"]) => Promise<void>;

  audioLab: AudioLabParams;
  setAudioLab: (patch: Partial<AudioLabParams>) => Promise<void>;

  calibration: RoomProfile | null;
  calibrating: boolean;
  runCalibration: () => Promise<void>;

  library: Track[];
  playlists: Playlist[];
  playback: PlaybackState;
  playTrack: (id: string) => Promise<void>;
  togglePause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  favorite: (id: string) => Promise<void>;
  scanning: boolean;
  addLibraryFolder: () => Promise<void>;

  profiles: Profile[];
  bindings: AppProfileBinding[];
  foregroundApp: string | null;

  appSettings: AppSettings;
  saveAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

const Store = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<SectionId>("home");
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deviceSettings, setDeviceSettings] =
    useState<DeviceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [audioLab, setAudioLabState] =
    useState<AudioLabParams>(defaultAudioLab());

  const [calibration, setCalibration] = useState<RoomProfile | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const [library, setLibrary] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [scanning, setScanning] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>({
    playing: false,
    trackId: null,
    positionSecs: 0,
    shuffle: false,
    repeat: false,
  });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [bindings, setBindings] = useState<AppProfileBinding[]>([]);
  const [foregroundApp, setForegroundApp] = useState<string | null>(null);

  const [appSettings, setAppSettings] =
    useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const notify = useCallback((msg: string) => setStatus(msg), []);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  const refreshDevices = useCallback(async () => {
    try {
      const list = await api.listDevices();
      setDevices(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setStatus(`Error listing devices: ${e}`);
    }
  }, []);

  useEffect(() => {
    refreshDevices().finally(() => setLoading(false));
    api
      .getLibrary()
      .then(setLibrary)
      .catch(() => {});
    api
      .getPlaylists()
      .then(setPlaylists)
      .catch(() => {});
    api
      .getProfiles()
      .then(setProfiles)
      .catch(() => {});
    api
      .getAppProfileBindings()
      .then(setBindings)
      .catch(() => {});
    api
      .getAppSettings()
      .then((s) => {
        setAppSettings(s);
        if (s.lastDeviceId) setSelectedId(s.lastDeviceId);
      })
      .catch(() => {});
    api
      .getForegroundApp()
      .then(setForegroundApp)
      .catch(() => {});
  }, [refreshDevices]);

  // Poll real playback state (position ticks from the actual audio backend,
  // and the queue can auto-advance server-side once a track finishes).
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api
        .getPlayback()
        .then((p) => {
          if (!cancelled) setPlayback(p);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 800);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api
      .getDeviceSettings(selectedId)
      .then(setDeviceSettings)
      .catch(() => setDeviceSettings(DEFAULT_SETTINGS));
  }, [selectedId]);

  const patchDevice = (patch: Partial<DeviceSettings>) =>
    setDeviceSettings((prev) => ({ ...prev, ...patch }));

  const selectDevice = useCallback(async (id: string) => {
    setSelectedId(id);
    setBusy(true);
    try {
      const updated = await api.connectDevice(id, "usb");
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e) {
      setStatus(`Connect failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const onVolume = useCallback(
    async (volume: number) => {
      patchDevice({ volume });
      if (selectedId) {
        try {
          await api.setVolume(selectedId, volume);
        } catch (e) {
          setStatus(`Volume failed: ${e}`);
        }
      }
    },
    [selectedId],
  );

  const onMute = useCallback(
    async (muted: boolean) => {
      patchDevice({ muted });
      if (selectedId) {
        try {
          await api.setMute(selectedId, muted);
        } catch (e) {
          setStatus(`Mute failed: ${e}`);
        }
      }
    },
    [selectedId],
  );

  const onEq = useCallback(
    async (gains: number[]) => {
      patchDevice({ eq: gains, preset: "FLAT" });
      if (selectedId) {
        try {
          await api.setEq(selectedId, gains);
        } catch (e) {
          setStatus(`EQ failed: ${e}`);
        }
      }
    },
    [selectedId],
  );

  const onPreset = useCallback(
    async (preset: string) => {
      patchDevice({ preset: preset as DeviceSettings["preset"] });
      if (selectedId) {
        try {
          await api.applyPreset(selectedId, preset);
        } catch (e) {
          setStatus(`Preset failed: ${e}`);
        }
      }
    },
    [selectedId],
  );

  const onSubwoofer = useCallback(
    async (sub: DeviceSettings["subwoofer"]) => {
      patchDevice({ subwoofer: sub });
      if (selectedId) {
        try {
          await api.setSubwoofer(selectedId, sub);
        } catch (e) {
          setStatus(`Subwoofer failed: ${e}`);
        }
      }
    },
    [selectedId],
  );

  const setAudioLab = useCallback(
    async (patch: Partial<AudioLabParams>) => {
      setAudioLabState((prev) => {
        const next = { ...prev, ...patch };
        if (selectedId)
          api
            .setAudioLab(selectedId, next)
            .catch((e) => setStatus(`Audio lab: ${e}`));
        return next;
      });
    },
    [selectedId],
  );

  const runCalibration = useCallback(async () => {
    if (!selectedId) return;
    setCalibrating(true);
    try {
      const result = await api.runCalibration(selectedId);
      setCalibration(result);
      setStatus("Calibration complete");
      if (result.curve) await api.setEq(selectedId, result.curve);
    } catch (e) {
      setStatus(`Calibration failed: ${e}`);
    } finally {
      setCalibrating(false);
    }
  }, [selectedId]);

  const playTrack = useCallback(async (id: string) => {
    try {
      setPlayback(await api.playerPlay(id));
    } catch (e) {
      setStatus(`Play failed: ${e}`);
    }
  }, []);

  const togglePause = useCallback(async () => {
    try {
      setPlayback(await api.playerTogglePause());
    } catch (e) {
      setStatus(`Pause failed: ${e}`);
    }
  }, []);

  const next = useCallback(async () => {
    try {
      setPlayback(await api.playerNext());
    } catch (e) {
      setStatus(`Next failed: ${e}`);
    }
  }, []);

  const previous = useCallback(async () => {
    try {
      setPlayback(await api.playerPrevious());
    } catch (e) {
      setStatus(`Previous failed: ${e}`);
    }
  }, []);

  const favorite = useCallback(async (id: string) => {
    try {
      setLibrary(await api.toggleFavorite(id));
    } catch (e) {
      setStatus(`Favorite failed: ${e}`);
    }
  }, []);

  const addLibraryFolder = useCallback(async () => {
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Selecionar pasta de música",
      });
      if (!picked || Array.isArray(picked)) return;
      const nextPaths = appSettings.libraryPaths.includes(picked)
        ? appSettings.libraryPaths
        : [...appSettings.libraryPaths, picked];
      setScanning(true);
      try {
        const tracks = await api.scanLibrary(nextPaths);
        setLibrary(tracks);
        setPlaylists([]);
        notify(`Biblioteca escaneada: ${tracks.length} faixa(s) encontrada(s)`);
      } finally {
        setScanning(false);
      }
      await saveAppSettings({ libraryPaths: nextPaths });
    } catch (e) {
      setStatus(`Library scan failed: ${e}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSettings.libraryPaths, notify]);

  const saveAppSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next = { ...prev, ...patch };
      api.setAppSettings(next).catch((e) => setStatus(`Settings: ${e}`));
      return next;
    });
  }, []);

  const store: AppStore = {
    section,
    setSection,
    devices,
    selectedId,
    selected,
    deviceSettings,
    loading,
    busy,
    status,
    notify,
    refreshDevices,
    selectDevice,
    onVolume,
    onMute,
    onEq,
    onPreset,
    onSubwoofer,
    audioLab,
    setAudioLab,
    calibration,
    calibrating,
    runCalibration,
    library,
    playlists,
    playback,
    playTrack,
    togglePause,
    next,
    previous,
    favorite,
    scanning,
    addLibraryFolder,
    profiles,
    bindings,
    foregroundApp,
    appSettings,
    saveAppSettings,
  };

  return <Store.Provider value={store}>{children}</Store.Provider>;
}

export function useApp(): AppStore {
  const ctx = useContext(Store);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
