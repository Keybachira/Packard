interface Props {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ label, checked, onChange, disabled }: Props) {
  return (
    <button type="button" className="toggle-row" onClick={() => onChange(!checked)} disabled={disabled}>
      <span className="toggle-text">{label}</span>
      <span className={`toggle-switch ${checked ? "on" : ""}`}>
        <span className="toggle-knob" />
      </span>
    </button>
  );
}
