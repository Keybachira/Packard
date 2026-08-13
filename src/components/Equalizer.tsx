import { EQ_BANDS } from "../types/audio";

interface Props {
  gains: number[];
  onChange: (gains: number[]) => void;
  disabled?: boolean;
}

const GAIN_MIN = -12;
const GAIN_MAX = 12;

export default function Equalizer({ gains, onChange, disabled }: Props) {
  const handleChange = (idx: number, value: number) => {
    const next = [...gains];
    next[idx] = value;
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-widest text-text-dim">EQ</h2>
        <span className="font-mono text-xs text-accent">
          {EQ_BANDS.reduce((sum, _, i) => sum + Math.abs(gains[i] ?? 0), 0) > 0
            ? "CUSTOM"
            : "FLAT"}
        </span>
      </div>

      <div className="flex items-end justify-between gap-1" style={{ height: 180 }}>
        {EQ_BANDS.map((band, i) => {
          const gain = gains[i] ?? 0;
          const height = ((gain - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100;
          const isBoost = gain > 0;
          const isCut = gain < 0;
          return (
            <div key={band.frequency} className="flex flex-1 flex-col items-center gap-2">
              <span className={`font-mono text-[10px] ${gain === 0 ? "text-text-dim" : "text-text"}`}>
                {gain > 0 ? `+${gain}` : gain}
              </span>
              <div className="relative" style={{ height: 140 }}>
                <input
                  type="range"
                  min={GAIN_MIN}
                  max={GAIN_MAX}
                  step={1}
                  value={gain}
                  disabled={disabled}
                  onChange={(e) => handleChange(i, Number(e.target.value))}
                  className="h-full w-8"
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                  }}
                  aria-label={`${band.label} gain`}
                />
                <div
                  className="pointer-events-none absolute left-1/2 w-1 -translate-x-1/2 rounded"
                  style={{
                    bottom: 0,
                    height: `${height}%`,
                    background: isBoost
                      ? "var(--color-accent)"
                      : isCut
                        ? "var(--color-accent-dim)"
                        : "transparent",
                    opacity: 0.35,
                  }}
                />
              </div>
              <span
                className="block h-1 w-full rounded"
                style={{
                  background: isBoost
                    ? "var(--color-accent)"
                    : isCut
                      ? "var(--color-accent-dim)"
                      : "var(--color-border)",
                }}
              />
              <span className="text-[10px] text-text-dim">{band.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
