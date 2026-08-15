import { useCallback, useRef } from "react";
import { IconVolume } from "./icons";

interface Props {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

const CX = 85;
const CY = 95;
const TRACK_R = 70;
const TICK_OUT = 82;

const TICKS: { f: number; major: boolean }[] = Array.from({ length: 21 }, (_, i) => ({
  f: i / 20,
  major: i % 5 === 0,
}));

function tickLine(f: number, r1: number) {
  const a = Math.PI - f * Math.PI;
  return {
    x1: CX + r1 * Math.cos(a),
    y1: CY - r1 * Math.sin(a),
    x2: CX + TICK_OUT * Math.cos(a),
    y2: CY - TICK_OUT * Math.sin(a),
  };
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
          <filter id="knobGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base track */}
        <path
          d={`M ${CX - TRACK_R} ${CY} A ${TRACK_R} ${TRACK_R} 0 0 1 ${CX + TRACK_R} ${CY}`}
          fill="none"
          stroke="var(--track)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* subtle centerline detail */}
        <path
          d={`M ${CX - TRACK_R} ${CY} A ${TRACK_R} ${TRACK_R} 0 0 1 ${CX + TRACK_R} ${CY}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="2"
          strokeDasharray="1 5"
          strokeLinecap="round"
        />
        {/* progress arc */}
        <path
          d={`M ${CX - TRACK_R} ${CY} A ${TRACK_R} ${TRACK_R} 0 0 1 ${CX + TRACK_R} ${CY}`}
          fill="none"
          stroke="url(#knobGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${angle} 100`}
          filter="url(#knobGlow)"
        />

        {/* ticks */}
        {TICKS.map((t, i) => {
          const { x1, y1, x2, y2 } = tickLine(t.f, t.major ? 72 : 77);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={t.major ? "var(--text-dim)" : "var(--text-faint)"}
              strokeWidth={t.major ? 2 : 1.2}
              strokeLinecap="round"
            />
          );
        })}

        {/* dashed frame ring around the knob face */}
        <circle
          cx="85"
          cy="62"
          r="36"
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.5"
          strokeDasharray="2 8"
          strokeLinecap="round"
          transform="rotate(90 85 62)"
        />

        {/* pointer */}
        <g transform={`rotate(${-90 + angle} ${CX} ${CY})`}>
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2="37"
            stroke="rgba(255, 255, 255, 0.92)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#knobGlow)"
          />
          <circle cx={CX} cy="33" r="4" fill="#fff" filter="url(#knobGlow)" />
        </g>
      </svg>
      <div className="knob-center" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
        <IconVolume size={20} />
      </div>
    </div>
  );
}
