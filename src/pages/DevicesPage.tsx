import { useApp } from "../context/AppStore";
import DeviceManager from "../components/DeviceManager";
import Panel from "../components/Panel";
import Slider from "../components/Slider";

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

  return (
    <div className="page">
      <div className="grid" style={{ gridTemplateColumns: "300px 1fr" }}>
        <DeviceManager
          devices={devices}
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
                    {selected.connection} · {selected.connected ? "Conectado" : "Offline"}
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
                  <SpecRow label="Conexão" value={selected.connection.toUpperCase()} />
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["USB", "Bluetooth", "HDMI", "DACs", "Fones de Ouvido", "Microfones", "Interfaces de Áudio"].map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
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
