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
    <label className="field">
      {(label || showValue) && (
        <div className="field-head">
          {label && <span className="field-label">{label}</span>}
          {showValue && (
            <span className="field-value num">
              {value}
              <span className="unit">{unit}</span>
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
      />
    </label>
  );
}
