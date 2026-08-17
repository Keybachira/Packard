import type { Playlist, Track } from "../../types/audio";
import { IconList, IconX } from "../icons";

interface Props {
  tracks: Track[];
  playlists: Playlist[];
  library: Track[];
  onAdd: (playlistId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export default function PlaylistPicker({
  tracks,
  playlists,
  library,
  onAdd,
  onCreate,
  onClose,
}: Props) {
  const countIn = (pl: Playlist) =>
    pl.trackIds.filter((id) => library.some((t) => t.id === id)).length;
  const summary =
    tracks.length === 1
      ? `${tracks[0].title} - ${tracks[0].artist}`
      : `${tracks.length} faixas selecionadas`;

  const create = () => {
    const name = window.prompt("Nome da playlist");
    if (name?.trim()) onCreate(name.trim());
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h3>Adicionar a playlist</h3>
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
          {summary}
        </div>
        <div className="modal-list">
          <button className="modal-pl" onClick={create}>
            <span className="pl-art">
              <IconList size={16} />
            </span>
            <span className="pl-meta">
              <span className="pl-name">Nova playlist</span>
              <br />
              <span className="pl-count">Criar e adicionar</span>
            </span>
          </button>
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
        </div>
      </div>
    </div>
  );
}
