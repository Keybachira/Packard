import { useCallback, useRef } from "react";

interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

const GAIN_MIN = -12;
const GAIN_MAX = 12;

export default function EqBand({ label, value, onChange, disabled }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ value: number } | null>(null);

  const setFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = (rect.bottom - clientY) / rect.height;
      const next = Math.round(
        GAIN_MIN + Math.max(0, Math.min(1, ratio)) * (GAIN_MAX - GAIN_MIN),
      );
      onChange(next);
    },
    [onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { value };
      setFromClientY(e.clientY);
    },
    [disabled, setFromClientY, value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      setFromClientY(e.clientY);
    },
    [setFromClientY],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const percent = ((value - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100;
  const positive = value >= 0;
  const fillHeight = Math.abs(value) / GAIN_MAX / 2;

  return (
    <div className="eq-band">
      <div
        className="eq-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="eq-mid-line" />
        <div
          className={`eq-fill ${positive ? "" : "neg"}`}
          style={{ height: `${fillHeight * 100}%` }}
        />
        <div
          className="eq-handle"
          style={{
            bottom: `${percent}%`,
            cursor: disabled ? "not-allowed" : "grab",
          }}
        />
      </div>
      <span className="eq-freq">{label}</span>
    </div>
  );
}
