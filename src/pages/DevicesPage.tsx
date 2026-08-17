import { useMemo, useState } from "react";
import { useApp } from "../context/AppStore";
import DeviceManager from "../components/DeviceManager";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import { connectionLabel, iconForConnection } from "../components/icons";
import type { ConnectionType } from "../types/audio";
import styles from "./DevicesPage.module.css";

const TRANSPORT_TYPES: ConnectionType[] = [
  "usb",
  "bluetooth",
  "hdmi",
  "dac",
  "headphones",
  "microphone",
  "audio_interface",
];

export default function DevicesPage() {
  const {
    devices,
    selectedId,
    selectDevice,
    refreshDevices,
    busy,
    loading,
    selected,
    deviceSettings,
    onVolume,
    onMute,
  } = useApp();

  const [transportFilter, setTransportFilter] = useState<ConnectionType | null>(null);

  const counts = useMemo(() => {
    const map = new Map<ConnectionType, number>();
    for (const d of devices) {
      map.set(d.connection, (map.get(d.connection) ?? 0) + 1);
    }
    return map;
  }, [devices]);

  const filteredDevices = useMemo(
    () =>
      transportFilter
        ? devices.filter((d) => d.connection === transportFilter)
        : devices,
    [devices, transportFilter]
  );

  const toggleTransport = (t: ConnectionType) =>
    setTransportFilter((cur) => (cur === t ? null : t));

  return (
    <div className="page">
      <div className="grid" style={{ gridTemplateColumns: "300px 1fr" }}>
        <DeviceManager
          devices={filteredDevices}
          selectedId={selectedId}
          onSelect={selectDevice}
          onRefresh={refreshDevices}
          disabled={busy}
        />

        <Panel title="DETALHES DO DISPOSITIVO">
          {loading ? (
            <p style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>
              Escaneando…
            </p>
          ) : selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={selected.connected ? "status-dot" : ""} style={!selected.connected ? { width: 7, height: 7, borderRadius: "50%", background: "var(--text-faint)" } : undefined} />
                <div>
                  <div className="device-name" style={{ margin: 0, fontSize: 16 }}>{selected.name}</div>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, color: "var(--text-faint)", textTransform: "uppercase", marginTop: 2 }}>
                    {connectionLabel(selected.connection)} · {selected.connected ? "Conectado" : "Offline"}
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ marginLeft: "auto" }}
                  onClick={() => onMute(!deviceSettings.muted)}
                  disabled={!selected.connected}
                >
                  {deviceSettings.muted ? "ATIVAR SOM" : "MUDO"}
                </button>
              </div>

              <div className="grid grid-2">
                <div className="box">
                  <div className="box-label">Volume Principal</div>
                  <div className="box-value num">
                    {deviceSettings.muted ? 0 : deviceSettings.volume}
                    <span className="unit">%</span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Slider
                      value={deviceSettings.muted ? 0 : deviceSettings.volume}
                      min={0}
                      max={100}
                      onChange={onVolume}
                      disabled={!selected.connected}
                      showValue={false}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <SpecRow label="Taxa de Amostragem" value="48 kHz" />
                  <SpecRow label="Profundidade de Bits" value="24-bit" />
                  <SpecRow label="Canais" value="2.0 (estéreo)" />
                  <SpecRow label="Conexão" value={connectionLabel(selected.connection)} />
                  <SpecRow label="Padrão do Sistema" value={selected.isDefault ? "Sim" : "Não"} />
                </div>
              </div>
            </div>
          ) : (
            <p style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>
              Nenhum dispositivo selecionado. Conecte uma soundbar para começar.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="TRANSPORTE FUTURO">
        <div className={styles.transportGrid}>
          {TRANSPORT_TYPES.map((t) => {
            const n = counts.get(t) ?? 0;
            const active = transportFilter === t;
            const isSelected = selected?.connection === t;
            const meta = active
              ? "filtro ativo"
              : isSelected
                ? "conectado"
                : n > 0
                  ? `${n} detectado${n !== 1 ? "s" : ""}`
                  : "—";
            return (
              <button
                key={t}
                className={`${styles.transportCard} ${
                  active ? styles.transportCardActive : ""
                }`}
                onClick={() => toggleTransport(t)}
              >
                <span className={styles.transportIcon}>
                  {iconForConnection(t, { size: 18 })}
                </span>
                <span className={styles.transportInfo}>
                  <span className={styles.transportName}>
                    {connectionLabel(t)}
                  </span>
                  <span className={styles.transportMeta}>{meta}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="box" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px" }}>
      <span style={{ fontSize: 10.5, letterSpacing: 1, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </span>
      <span className="num" style={{ fontSize: 12, color: "var(--text)" }}>{value}</span>
    </div>
  );
}
