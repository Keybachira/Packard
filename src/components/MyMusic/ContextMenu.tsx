import { useEffect, useState } from "react";
import type { Track } from "../../types/audio";
import {
  IconHeart,
  IconPlay,
  IconPlus,
  IconTrash,
} from "../icons";

interface MenuItem {
  label: string;
  icon: typeof IconPlay;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  track: Track;
  isFavorite: boolean;
  inPlaylist?: boolean;
  onPlay: () => void;
  onAddToPlaylist: () => void;
  onFavorite: () => void;
  onRemoveFromPlaylist?: () => void;
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  track,
  isFavorite,
  inPlaylist = false,
  onPlay,
  onAddToPlaylist,
  onFavorite,
  onRemoveFromPlaylist,
  onClose,
}: Props) {
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const mx = window.innerWidth;
    const my = window.innerHeight;
    const w = 230;
    const h = inPlaylist ? 190 : 170;
    setPos({
      x: Math.min(x, mx - w - 12),
      y: Math.min(y, my - h - 12),
    });
  }, [x, y, inPlaylist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(".context-menu")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const items: MenuItem[] = [
    { label: "Reproduzir", icon: IconPlay, onClick: onPlay },
    {
      label: "Adicionar à playlist",
      icon: IconPlus,
      onClick: onAddToPlaylist,
    },
    {
      label: isFavorite ? "Remover favorito" : "Adicionar favorito",
      icon: IconHeart,
      onClick: onFavorite,
    },
    ...(inPlaylist && onRemoveFromPlaylist
      ? [
          {
            label: "Remover da playlist",
            icon: IconTrash,
            onClick: onRemoveFromPlaylist,
            danger: true,
          } as MenuItem,
        ]
      : []),
  ];

  return (
    <div className="context-menu" style={{ left: pos.x, top: pos.y }}>
      <div
        style={{
          padding: "6px 12px 8px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          borderBottom: "1px solid var(--border-soft)",
          marginBottom: 6,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {track.title}
      </div>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.label}
            className={`context-menu-item${it.danger ? " danger" : ""}`}
            onClick={it.onClick}
          >
            <Icon size={15} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}