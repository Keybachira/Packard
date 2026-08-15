import type { Playlist, Track } from "../../types/audio";
import { IconList, IconX } from "../icons";

interface Props {
  track: Track;
  playlists: Playlist[];
  library: Track[];
  onAdd: (playlistId: string) => void;
  onClose: () => void;
}

export default function PlaylistPicker({
  track,
  playlists,
  library,
  onAdd,
  onClose,
}: Props) {
  const countIn = (pl: Playlist) =>
    pl.trackIds.filter((id) => library.some((t) => t.id === id)).length;

  return (
    <div className="modal-overlay" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-card">
        <div className="modal-head">
          <h3>Adicionar à playlist</h3>
          <button className="modal-close" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.title} — {track.artist}
        </div>
        <div className="modal-list">
          {playlists.map((pl) => (
            <button key={pl.id} className="modal-pl" onClick={() => onAdd(pl.id)}>
              <span className="pl-art">
                <IconList size={16} />
              </span>
              <span className="pl-meta">
                <span className="pl-name">{pl.name}</span>
                <br />
                <span className="pl-count">{countIn(pl)} faixas</span>
              </span>
            </button>
          ))}
          {playlists.length === 0 && (
            <div
              style={{
                padding: "20px 10px",
                textAlign: "center",
                color: "var(--text-faint)",
                fontSize: 13,
              }}
            >
              Nenhuma playlist disponível.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}