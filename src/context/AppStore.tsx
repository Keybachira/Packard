import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  ToastItem,
  ToastVariant,
  Track,
} from "../types/audio";
import { defaultAudioLab, EQ_BANDS } from "../types/audio";

const TOAST_LIFETIME_MS = 4200;
const NOTIFICATION_HISTORY_LIMIT = 30;

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
  | "remote"
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
  onboarded: false,
  accent: "#22c55e",
  username: "",
  avatar: "",
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
  notify: (msg: string, variant?: ToastVariant) => void;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  notifications: ToastItem[];
  hasUnreadNotifications: boolean;
  markNotificationsRead: () => void;
  clearNotifications: () => void;

  miniMode: boolean;
  toggleMiniMode: () => Promise<void>;

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
  queue: Track[];
  playback: PlaybackState;
  history: Track[];
  playTrack: (id: string) => Promise<void>;
  playCollection: (trackId: string, ids: string[]) => Promise<void>;
  enqueue: (ids: string[]) => Promise<void>;
  enqueueNext: (ids: string[]) => Promise<void>;
  removeFromQueue: (trackId: string) => Promise<void>;
  reorderQueue: (from: number, to: number) => Promise<void>;
  setShuffle: (shuffle: boolean) => Promise<void>;
  setRepeat: (repeat: boolean) => Promise<void>;
  seek: (positionSecs: number) => Promise<void>;
  togglePause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  favorite: (id: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist | null>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (id: string, trackIds: string[]) => Promise<void>;
  removeFromPlaylist: (id: string, trackId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  getArt: (trackId: string) => Promise<string | null>;
  scanning: boolean;
  addLibraryFolder: () => Promise<void>;

  profiles: Profile[];
  bindings: AppProfileBinding[];
  foregroundApp: string | null;

  appSettings: AppSettings;
  settingsReady: boolean;
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

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<ToastItem[]>([]);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [miniMode, setMiniMode] = useState(false);

  const [audioLab, setAudioLabState] =
    useState<AudioLabParams>(defaultAudioLab());

  const [calibration, setCalibration] = useState<RoomProfile | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const [library, setLibrary] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const artCacheRef = useRef<Record<string, string | null>>({});
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
  const [settingsReady, setSettingsReady] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      // Keep the legacy bottom status pill in sync for any code still
      // reading `status` directly.
      setStatus(message);

      const item: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        variant,
        time: Date.now(),
      };

      setNotifications((prev) => [item, ...prev].slice(0, NOTIFICATION_HISTORY_LIMIT));
      setHasUnreadNotifications(true);

      if (appSettings.notifications === false) return;

      setToasts((prev) => [...prev, item]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
        toastTimers.current.delete(item.id);
      }, TOAST_LIFETIME_MS);
      toastTimers.current.set(item.id, timer);
    },
    [appSettings.notifications],
  );

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const notify = useCallback(
    (msg: string, variant: ToastVariant = "info") => pushToast(msg, variant),
    [pushToast],
  );

  const markNotificationsRead = useCallback(() => setHasUnreadNotifications(false), []);
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setHasUnreadNotifications(false);
  }, []);

  const toggleMiniMode = useCallback(async () => {
    try {
      if (miniMode) {
        await api.exitMiniMode();
        setMiniMode(false);
      } else {
        await api.enterMiniMode();
        setMiniMode(true);
      }
    } catch (e) {
      pushToast(`Modo mini falhou: ${e}`, "error");
    }
  }, [miniMode, pushToast]);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  // Tracks the previous poll's device list so background refreshes can
  // detect what changed (plugged/unplugged, default endpoint switched)
  // instead of just silently replacing the array.
  const prevDevicesRef = useRef<AudioDevice[] | null>(null);

  const refreshDevices = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const list = await api.listDevices();
      const prev = prevDevicesRef.current;

      if (prev) {
        const prevIds = new Set(prev.map((d) => d.id));
        const nextIds = new Set(list.map((d) => d.id));

        for (const device of list) {
          if (!prevIds.has(device.id)) {
            notify(`Dispositivo conectado: ${device.name}`, "success");
          }
        }
        for (const device of prev) {
          if (!nextIds.has(device.id)) {
            notify(`Dispositivo desconectado: ${device.name}`, "info");
          }
        }

        const prevDefault = prev.find((d) => d.isDefault) ?? null;
        const nextDefault = list.find((d) => d.isDefault) ?? null;
        if (nextDefault && nextDefault.id !== prevDefault?.id) {
          notify(`Dispositivo padrão do sistema: ${nextDefault.name}`, "info");
        }
      }
      prevDevicesRef.current = list;

      setDevices(list);
      setSelectedId((current) => {
        if (current && list.some((d) => d.id === current)) return current;
        // The selected device vanished (unplugged) — fall back to the
        // system default, or the first device available.
        const fallback = list.find((d) => d.isDefault) ?? list[0] ?? null;
        if (current && fallback) {
          notify(`Dispositivo ativo desconectado. Usando ${fallback.name}.`, "info");
        }
        return fallback?.id ?? null;
      });
    } catch (e) {
      if (!opts?.silent) notify(`Erro ao listar dispositivos: ${e}`, "error");
    }
  }, []);

  // Periodically re-enumerate audio endpoints so plugging/unplugging a
  // device (or the OS switching the default output) is picked up without
  // the user having to hit "Atualizar" manually.
  useEffect(() => {
    const id = setInterval(() => refreshDevices({ silent: true }), 2500);
    return () => clearInterval(id);
  }, [refreshDevices]);

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
      .catch(() => {})
      .finally(() => setSettingsReady(true));
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
      api
        .getQueue()
        .then((q) => {
          if (!cancelled) setQueue(q);
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

  // Recently played list refreshes on a slower cadence (only changes when a
  // new track starts).
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api
        .getHistory()
        .then((h) => {
          if (!cancelled) setHistory(h);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
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
      const existing = devices.find((d) => d.id === id);
      const updated = await api.connectDevice(id, existing?.connection ?? "none");
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e) {
      notify(`Falha ao conectar: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }, [devices]);

  const onVolume = useCallback(
    async (volume: number) => {
      patchDevice({ volume });
      if (selectedId) {
        try {
          await api.setVolume(selectedId, volume);
        } catch (e) {
          notify(`Falha ao ajustar volume: ${e}`, "error");
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
          notify(`Falha ao silenciar: ${e}`, "error");
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
          notify(`Falha ao aplicar EQ: ${e}`, "error");
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
          notify(`Falha ao aplicar preset: ${e}`, "error");
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
          notify(`Falha no subwoofer: ${e}`, "error");
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
            .catch((e) => notify(`Erro no Audio Lab: ${e}`, "error"));
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
      notify("Calibração concluída", "success");
      if (result.curve) await api.setEq(selectedId, result.curve);
    } catch (e) {
      notify(`Falha na calibração: ${e}`, "error");
    } finally {
      setCalibrating(false);
    }
  }, [selectedId]);

  const playTrack = useCallback(async (id: string) => {
    try {
      setPlayback(await api.playerPlay(id));
    } catch (e) {
      notify(`Falha ao reproduzir: ${e}`, "error");
    }
  }, []);

  const togglePause = useCallback(async () => {
    try {
      setPlayback(await api.playerTogglePause());
    } catch (e) {
      notify(`Falha ao pausar: ${e}`, "error");
    }
  }, []);

  const next = useCallback(async () => {
    try {
      setPlayback(await api.playerNext());
    } catch (e) {
      notify(`Falha ao avançar: ${e}`, "error");
    }
  }, []);

  const previous = useCallback(async () => {
    try {
      setPlayback(await api.playerPrevious());
    } catch (e) {
      notify(`Falha ao voltar: ${e}`, "error");
    }
  }, []);

  const favorite = useCallback(async (id: string) => {
    try {
      setLibrary(await api.toggleFavorite(id));
    } catch (e) {
      notify(`Falha ao favoritar: ${e}`, "error");
    }
  }, []);

  const playCollection = useCallback(async (trackId: string, ids: string[]) => {
    try {
      setPlayback(await api.playerPlayCollection(trackId, ids));
    } catch (e) {
      notify(`Falha ao reproduzir: ${e}`, "error");
    }
  }, []);

  const enqueue = useCallback(async (ids: string[]) => {
    try {
      setQueue(await api.enqueueIds(ids));
    } catch (e) {
      notify(`Falha ao adicionar à fila: ${e}`, "error");
    }
  }, []);

  const enqueueNext = useCallback(async (ids: string[]) => {
    try {
      setQueue(await api.enqueueNextIds(ids));
    } catch (e) {
      notify(`Falha ao adicionar à fila: ${e}`, "error");
    }
  }, []);

  const removeFromQueue = useCallback(async (trackId: string) => {
    try {
      setQueue(await api.removeFromQueue(trackId));
    } catch (e) {
      notify(`Falha ao remover da fila: ${e}`, "error");
    }
  }, []);

  const reorderQueue = useCallback(async (from: number, to: number) => {
    try {
      setQueue(await api.reorderQueue(from, to));
    } catch (e) {
      notify(`Falha ao reordenar a fila: ${e}`, "error");
    }
  }, []);

  const setShuffle = useCallback(async (shuffle: boolean) => {
    try {
      setPlayback(await api.playerSetShuffle(shuffle));
    } catch (e) {
      notify(`Falha ao alternar shuffle: ${e}`, "error");
    }
  }, []);

  const setRepeat = useCallback(async (repeat: boolean) => {
    try {
      setPlayback(await api.playerSetRepeat(repeat));
    } catch (e) {
      notify(`Falha ao alternar repeat: ${e}`, "error");
    }
  }, []);

  const seek = useCallback(async (positionSecs: number) => {
    try {
      setPlayback(await api.playerSeek(positionSecs));
    } catch (e) {
      notify(`Falha ao buscar: ${e}`, "error");
    }
  }, []);

  const createPlaylist = useCallback(async (name: string) => {
    try {
      const pl = await api.createPlaylist(name);
      setPlaylists((prev) => [...prev, pl]);
      notify(`Playlist "${pl.name}" criada`, "success");
      return pl;
    } catch (e) {
      notify(`Falha ao criar playlist: ${e}`, "error");
      return null;
    }
  }, [notify]);

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      try {
        const pl = await api.renamePlaylist(id, name);
        setPlaylists((prev) => prev.map((p) => (p.id === id ? pl : p)));
      } catch (e) {
        notify(`Falha ao renomear playlist: ${e}`, "error");
      }
    },
    [notify],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      try {
        await api.deletePlaylist(id);
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        notify("Playlist removida", "success");
      } catch (e) {
        notify(`Falha ao remover playlist: ${e}`, "error");
      }
    },
    [notify],
  );

  const addToPlaylist = useCallback(
    async (id: string, trackIds: string[]) => {
      try {
        const pl = await api.addToPlaylist(id, trackIds);
        setPlaylists((prev) => prev.map((p) => (p.id === id ? pl : p)));
      } catch (e) {
        notify(`Falha ao adicionar à playlist: ${e}`, "error");
      }
    },
    [notify],
  );

  const removeFromPlaylist = useCallback(
    async (id: string, trackId: string) => {
      try {
        const pl = await api.removeFromPlaylist(id, trackId);
        setPlaylists((prev) => prev.map((p) => (p.id === id ? pl : p)));
      } catch (e) {
        notify(`Falha ao remover da playlist: ${e}`, "error");
      }
    },
    [notify],
  );

  const clearHistory = useCallback(
    async () => {
      try {
        await api.clearHistory();
        setHistory([]);
        notify("Histórico limpo", "success");
      } catch (e) {
        notify(`Falha ao limpar histórico: ${e}`, "error");
      }
    },
    [notify],
  );

  const getArt = useCallback(async (trackId: string) => {
    const cached = artCacheRef.current[trackId];
    if (cached !== undefined) return cached;
    const art = await api.getTrackArt(trackId).catch(() => null);
    artCacheRef.current[trackId] = art;
    return art;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = document.activeElement;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTyping || e.repeat) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.code === "ArrowRight" && e.ctrlKey) {
        e.preventDefault();
        next();
      } else if (e.code === "ArrowLeft" && e.ctrlKey) {
        e.preventDefault();
        previous();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        setShuffle(!playback.shuffle);
      } else if (e.code === "KeyR") {
        e.preventDefault();
        setRepeat(!playback.repeat);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, playback.repeat, playback.shuffle, previous, setRepeat, setShuffle, togglePause]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const current = library.find((t) => t.id === playback.trackId) ?? null;
    if (!current) return;

    let cancelled = false;
    getArt(current.id).then((art) => {
      if (cancelled) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album,
        artwork: art ? [{ src: art }] : undefined,
      });
    });
    navigator.mediaSession.playbackState = playback.playing ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", togglePause);
    navigator.mediaSession.setActionHandler("pause", togglePause);
    navigator.mediaSession.setActionHandler("previoustrack", previous);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") seek(details.seekTime);
    });

    return () => {
      cancelled = true;
    };
  }, [getArt, library, next, playback.playing, playback.trackId, previous, seek, togglePause]);

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
        notify(`Biblioteca escaneada: ${tracks.length} faixa(s) encontrada(s)`, "success");
      } finally {
        setScanning(false);
      }
      await saveAppSettings({ libraryPaths: nextPaths });
    } catch (e) {
      notify(`Falha ao escanear a biblioteca: ${e}`, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSettings.libraryPaths, notify]);

  const saveAppSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next = { ...prev, ...patch };
      api.setAppSettings(next).catch((e) => notify(`Configurações: ${e}`, "error"));
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
    toasts,
    dismissToast,
    notifications,
    hasUnreadNotifications,
    markNotificationsRead,
    clearNotifications,
    miniMode,
    toggleMiniMode,
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
    queue,
    playback,
    history,
    playTrack,
    playCollection,
    enqueue,
    enqueueNext,
    removeFromQueue,
    reorderQueue,
    setShuffle,
    setRepeat,
    seek,
    togglePause,
    next,
    previous,
    favorite,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    clearHistory,
    getArt,
    scanning,
    addLibraryFolder,
    profiles,
    bindings,
    foregroundApp,
    appSettings,
    settingsReady,
    saveAppSettings,
  };

  return <Store.Provider value={store}>{children}</Store.Provider>;
}

export function useApp(): AppStore {
  const ctx = useContext(Store);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
