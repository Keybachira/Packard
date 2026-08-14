import { formatTime } from "../lib/format";

interface Props {
  position: number;
  duration: number;
  compact?: boolean;
}

export default function ProgressBar({ position, duration, compact }: Props) {
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div className="bar-row">
      {!compact && <span className="time-label">{formatTime(position)}</span>}
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {!compact && <span className="time-label">{formatTime(duration)}</span>}
    </div>
  );
}
