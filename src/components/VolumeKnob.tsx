import { useCallback, useRef } from "react";
import { IconVolume } from "./icons";

interface Props {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export default function VolumeKnob({ value, min = 0, max = 100, onChange, disabled }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  const updateFromPointer = useCallback(
    (clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = (drag.startY - clientY) * 1.2;
      const next = Math.round(Math.max(min, Math.min(max, drag.startVal + delta)));
      onChange(next);
    },
    [min, max, onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startVal: value };
    },
    [disabled, value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      updateFromPointer(e.clientY);
    },
    [updateFromPointer],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const angle = (value / max) * 180;

  return (
    <div
      className="knob-wrap"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ touchAction: "none" }}
    >
      <svg width="170" height="100" viewBox="0 0 170 100">
        <defs>
          <linearGradient id="knobGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <path
          d="M 15 95 A 70 70 0 0 1 155 95"
          fill="none"
          stroke="var(--track)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 15 95 A 70 70 0 0 1 155 95"
          fill="none"
          stroke="url(#knobGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${angle} 100`}
        />
        <circle
          cx="85"
          cy="62"
          r="34"
          fill="none"
          stroke="var(--track)"
          strokeWidth="3"
          strokeDasharray="160 240"
          strokeLinecap="round"
          transform="rotate(90 85 62)"
        />
      </svg>
      <div className="knob-center" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
        <IconVolume size={20} />
      </div>
    </div>
  );
}