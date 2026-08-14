import type { AudioDevice } from "../types/audio";
import { IconBluetooth, IconUsb } from "./icons";

interface Props {
  devices: AudioDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export default function DeviceManager({
  devices,
  selectedId,
  onSelect,
  onRefresh,
  disabled,
}: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="eyebrow">DISPOSITIVO</span>
        <button className="btn-ghost" onClick={onRefresh} disabled={disabled}>
          ↻ Atualizar
        </button>
      </div>

      {devices.length === 0 && (
        <p
          style={{
            color: "var(--text-faint)",
            fontSize: 12.5,
            padding: "18px 0",
            textAlign: "center",
          }}
        >
          Nenhum dispositivo encontrado. Conecte uma soundbar via USB ou
          Bluetooth.
        </p>
      )}
      {devices.map((device) => (
        <div
          className="dev-row"
          key={device.id}
          onClick={() => !disabled && onSelect(device.id)}
          style={{ cursor: disabled ? "default" : "pointer" }}
        >
          <div className={`dev-icon ${device.id === selectedId ? "on" : ""}`}>
            {device.connection === "usb" ? (
              <IconUsb size={18} />
            ) : (
              <IconBluetooth size={18} />
            )}
          </div>
          <div className="dev-info">
            <div className="n">{device.name}</div>
            <div className={`s ${device.connected ? "on" : ""}`}>
              <span className="d" />
              {device.connected
                ? `Conectado · ${Math.round(device.volume)}%`
                : "Offline"}
            </div>
          </div>
          {device.id === selectedId && <span className="badge on">ATIVO</span>}
        </div>
      ))}
    </div>
  );
}
