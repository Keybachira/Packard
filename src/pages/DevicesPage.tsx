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
    <div className="flex h-full flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <DeviceManager
          devices={devices}
          selectedId={selectedId}
          onSelect={selectDevice}
          onRefresh={refreshDevices}
          disabled={busy}
        />

        <Panel title="Device Details">
          {loading ? (
            <p className="py-8 text-center text-xs text-text-dim">Scanning…</p>
          ) : selected ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${selected.connected ? "bg-accent" : "bg-text-dim"}`}
                />
                <div>
                  <h3 className="text-base font-semibold text-text">{selected.name}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-text-dim">
                    {selected.connection} · {selected.connected ? "CONNECTED" : "OFFLINE"}
                  </p>
                </div>
                <button
                  onClick={() => onMute(!deviceSettings.muted)}
                  disabled={!selected.connected}
                  className="ml-auto rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-text-dim transition-colors hover:text-text"
                >
                  {deviceSettings.muted ? "UNMUTE" : "MUTE"}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-2/50 p-4">
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-text-dim">
                    Master Volume
                  </p>
                  <p className="font-mono text-2xl text-text">
                    {deviceSettings.muted ? 0 : deviceSettings.volume}
                    <span className="text-sm text-text-dim">%</span>
                  </p>
                  <div className="mt-2">
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

                <div className="space-y-3">
                  <SpecRow label="Sample Rate" value="48 kHz" />
                  <SpecRow label="Bit Depth" value="24-bit" />
                  <SpecRow label="Channels" value="2.0 (stereo)" />
                  <SpecRow label="Connection" value={selected.connection.toUpperCase()} />
                </div>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-text-dim">
              No device selected. Connect a soundbar to get started.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Future Transport">
        <div className="flex flex-wrap gap-2">
          {["USB", "Bluetooth", "HDMI", "DACs", "Headphones", "Microphones", "Audio Interfaces"].map(
            (t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[10px] text-text-dim"
              >
                {t}
              </span>
            ),
          )}
        </div>
      </Panel>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-text-dim">{label}</span>
      <span className="font-mono text-xs text-text">{value}</span>
    </div>
  );
}