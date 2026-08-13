interface Props {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  showValue?: boolean;
}

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  disabled,
  showValue = true,
}: Props) {
  return (
    <label className="block">
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between">
          {label && <span className="text-[10px] uppercase tracking-widest text-text-dim">{label}</span>}
          {showValue && (
            <span className="font-mono text-[11px] text-text">
              {value}
              <span className="text-text-dim">{unit}</span>
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}