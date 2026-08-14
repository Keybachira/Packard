import { EQ_BANDS } from "../types/audio";
import EqBand from "./EqBand";

interface Props {
  gains: number[];
  onChange: (gains: number[]) => void;
  disabled?: boolean;
}

export default function Equalizer({ gains, onChange, disabled }: Props) {
  const handleChange = (idx: number, value: number) => {
    const next = [...gains];
    next[idx] = value;
    onChange(next);
  };

  return (
    <div className="eq-body">
      <div className="eq-axis">
        {["+12", "+6", "0", "-6", "-12"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="eq-sliders">
        {EQ_BANDS.map((band, i) => (
          <EqBand
            key={band.frequency}
            label={band.label}
            value={gains[i] ?? 0}
            onChange={(v) => handleChange(i, v)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export function isFlatEq(gains: number[]) {
  return EQ_BANDS.every((_, i) => (gains[i] ?? 0) === 0);
}
