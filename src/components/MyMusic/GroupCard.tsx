import type { ReactNode } from "react";
import { IconPlay } from "../icons";

interface Props {
  name: string;
  subtitle: string;
  icon: ReactNode;
  gradient: string;
  onClick: () => void;
  onPlay?: () => void;
}

export default function GroupCard({
  name,
  subtitle,
  icon,
  gradient,
  onClick,
  onPlay,
}: Props) {
  return (
    <button
      className="group-card"
      onClick={onClick}
      onDoubleClick={onPlay}
    >
      <div className="group-art" style={{ background: gradient }}>
        {icon}
      </div>
      <span className="group-name">{name}</span>
      <span className="group-sub">{subtitle}</span>
      {onPlay && (
        <span
          className="group-play"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
        >
          <IconPlay size={15} />
        </span>
      )}
    </button>
  );
}