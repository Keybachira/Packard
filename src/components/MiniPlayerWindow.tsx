import { useMemo } from "react";
import { useApp } from "../context/AppStore";
import { IconExpand, IconHeart, IconNext, IconPause, IconPlay, IconPrev } from "./icons";
import { formatTime } from "../lib/format";

/**
 * Full-window compact player, mirrored after FLB.Music's "mini mode":
 * the OS window itself is shrunk and pinned to the bottom-right corner
 * (see enter_mini_mode/exit_mini_mode in src-tauri), and this component
 * fills that tiny window with just the essentials.
 */
export default function MiniPlayerWindow() {
  const { playback, library, togglePause, next, previous, favorite, toggleMiniMode } = useApp();

  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  const duration = current?.durationSecs ?? 0;
  const position = playback.positionSecs;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="mini-window" data-tauri-drag-region>
      <button
        className="mini-window-expand"
        title="Restaurar janela"
        onClick={() => toggleMiniMode()}
      >
        <IconExpand size={13} />
      </button>

      <div className="mini-window-row" data-tauri-drag-region>
        <div className="mini-window-art">
          <span>♫</span>
        </div>
        <div className="mini-window-meta">
          <div className="mini-window-title">{current?.title ?? "Nada tocando"}</div>
          <div className="mini-window-artist">{current?.artist ?? "SoundCore"}</div>
        </div>
        <button
          className={`mini-window-heart ${current?.favorite ? "active" : ""}`}
          onClick={() => current && favorite(current.id)}
          disabled={!current}
        >
          <IconHeart size={14} />
        </button>
      </div>

      <div className="mini-window-progress">
        <div className="mini-window-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="mini-window-times">
        <span>{formatTime(position)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="mini-window-controls">
        <button onClick={previous} title="Anterior">
          <IconPrev size={15} />
        </button>
        <button className="mini-window-play" onClick={togglePause} title="Reproduzir/Pausar">
          {playback.playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        <button onClick={next} title="Próxima">
          <IconNext size={15} />
        </button>
      </div>
    </div>
  );
}
