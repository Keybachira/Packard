import type { AudioDevice } from "../types/audio";

interface Props {
  devices: AudioDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

function ConnectionDot({ connection }: { connection: AudioDevice["connection"] }) {
  const color =
    connection === "usb"
      ? "bg-accent"
      : connection === "bluetooth"
        ? "bg-blue-400"
        : "bg-text-dim";
  return <span className={`h-2 w-2 rounded-full ${color}`} title={connection} />;
}

export default function DeviceManager({
  devices,
  selectedId,
  onSelect,
  onRefresh,
  disabled,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-widest text-text-dim">DEVICE</h2>
        <button
          onClick={onRefresh}
          disabled={disabled}
          className="rounded-lg border border-border bg-surface-2 px-3 py-1 text-xs text-text-dim transition-colors hover:text-text"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="space-y-2">
        {devices.length === 0 && (
          <p className="py-6 text-center text-xs text-text-dim">
            No devices found. Connect a soundbar via USB or Bluetooth.
          </p>
        )}
        {devices.map((device) => (
          <button
            key={device.id}
            onClick={() => onSelect(device.id)}
            disabled={disabled}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
              selectedId === device.id
                ? "border-accent bg-surface-2"
                : "border-border bg-surface-2 hover:border-border hover:brightness-125"
            }`}
          >
            <div className="flex items-center gap-3">
              <ConnectionDot connection={device.connection} />
              <span className="text-sm text-text">{device.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-dim">
                {device.connected ? `${Math.round(device.volume)}%` : "offline"}
              </span>
              {device.connected && (
                <span className="text-[10px] font-semibold tracking-widest text-accent">LIVE</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
