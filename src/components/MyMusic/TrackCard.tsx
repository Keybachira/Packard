import type { Track } from "../../types/audio";
import { formatTime } from "../../lib/format";
import { IconHeart, IconMore } from "../icons";

interface Props {
  track: Track;
  index: number;
  isPlaying: boolean;
  isFavorite: boolean;
  selectable?: boolean;
  selected?: boolean;
  onPlay: (id: string) => void;
  onTogglePause: () => void;
  onFavorite: (id: string) => void;
  onSelect?: (id: string, checked: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, track: Track) => void;
}

export default function TrackCard({
  track,
  index,
  isPlaying,
  isFavorite,
  selectable = false,
  selected = false,
  onPlay,
  onTogglePause,
  onFavorite,
  onSelect,
  onContextMenu,
}: Props) {
  const checkId = `chk-${track.id}`;

  const handleClick = () => {
    if (selectable) {
      onSelect?.(track.id, !selected);
    } else if (isPlaying) {
      onTogglePause();
    } else {
      onPlay(track.id);
    }
  };

  return (
    <div
      className={`track-card${isPlaying ? " playing" : ""}${selectable ? " selectable" : ""}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu?.(e, track)}
      data-track-id={track.id}
    >
      {selectable && (
        <div className="t-check">
          <input
            type="checkbox"
            id={checkId}
            checked={selected}
            onChange={(e) => onSelect?.(track.id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor={checkId}>
            {selected && (
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5 9-10" />
              </svg>
            )}
          </label>
        </div>
      )}
      <span className="t-num">
        {isPlaying ? "" : String(index + 1).padStart(2, "0")}
      </span>
      <span className="t-eq">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="t-title">{track.title}</span>
      <span className="t-artist">{track.artist}</span>
      <span className="t-album">{track.album}</span>
      <span className="t-dur">{formatTime(track.durationSecs)}</span>
      <button
        className={`t-fav${isFavorite ? " on" : ""}`}
        title={isFavorite ? "Remover favorito" : "Adicionar favorito"}
        onClick={(e) => {
          e.stopPropagation();
          onFavorite(track.id);
        }}
      >
        <IconHeart size={15} />
      </button>
      <button
        className="t-more"
        title="Mais opções"
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu?.(e, track);
        }}
      >
        <IconMore size={16} />
      </button>
    </div>
  );
}