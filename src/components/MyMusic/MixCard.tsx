import type { ReactNode } from "react";
import { IconPlay } from "../icons";

interface Props {
  name: string;
  subtitle: string;
  icon: ReactNode;
  gradient: string;
  onPlay: () => void;
}

export default function MixCard({
  name,
  subtitle,
  icon,
  gradient,
  onPlay,
}: Props) {
  return (
    <button className="mix-card" onClick={onPlay}>
      <div className="mix-art" style={{ background: gradient }}>
        {icon}
      </div>
      <span className="mix-name">{name}</span>
      <span className="mix-sub">{subtitle}</span>
      <span className="mix-play" onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}>
        <IconPlay size={15} />
      </span>
    </button>
  );
}