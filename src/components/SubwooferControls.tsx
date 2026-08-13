import type { SubwooferState } from "../types/audio";

interface Props {
  state: SubwooferState;
  onChange: (state: SubwooferState) => void;
  disabled?: boolean;
}

function Knob({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] tracking-widest text-text-dim">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32"
      />
      <span className="font-mono text-xs text-text">
        {value}
        <span className="text-text-dim">{unit}</span>
      </span>
    </div>
  );
}

export default function SubwooferControls({ state, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-widest text-text-dim">SUBWOOFER</h2>
        <button
          onClick={() => onChange({ ...state, enabled: !state.enabled })}
          disabled={disabled}
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-widest ${
            state.enabled
              ? "border-accent text-accent"
              : "border-border text-text-dim"
          }`}
        >
          {state.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <Knob
          label="Gain"
          value={state.gain}
          min={-12}
          max={12}
          unit="dB"
          disabled={disabled || !state.enabled}
          onChange={(gain) => onChange({ ...state, gain })}
        />
        <Knob
          label="Frequency"
          value={state.frequency}
          min={40}
          max={200}
          unit="Hz"
          disabled={disabled || !state.enabled}
          onChange={(frequency) => onChange({ ...state, frequency })}
        />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] tracking-widest text-text-dim">Phase</span>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {([0, 180] as const).map((p) => (
              <button
                key={p}
                onClick={() => onChange({ ...state, phase: p })}
                disabled={disabled || !state.enabled}
                className={`px-3 py-1.5 font-mono text-xs transition-colors ${
                  state.phase === p
                    ? "bg-accent text-black"
                    : "bg-surface-2 text-text-dim hover:text-text"
                }`}
              >
                {p}°
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
