import { useMemo } from "react";
import { useApp } from "../context/AppStore";
import {
  IconHeart,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconVolume,
} from "./icons";
import ProgressBar from "./ProgressBar";

export default function MiniPlayer() {
  const {
    playback,
    library,
    togglePause,
    next,
    previous,
    favorite,
    deviceSettings,
  } = useApp();

  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  if (!current) return null;

  const position = playback.positionSecs;

  return (
    <div className="mini-player">
      <div className="mini-top">
        <div className="mini-art" style={{ background: "var(--accent-soft)" }}>
          <span style={{ fontSize: 18 }}>♫</span>
        </div>
        <div className="mini-meta">
          <div className="t">{current.title}</div>
          <div className="s">{current.artist}</div>
        </div>
        <span
          className={`heart ${current.favorite ? "active" : ""}`}
          onClick={() => favorite(current.id)}
          style={{ display: "flex" }}
        >
          <IconHeart size={17} />
        </span>
      </div>

      <div className="mini-progress">
        <ProgressBar
          position={position}
          duration={current.durationSecs}
          compact
        />
      </div>

      <div className="mini-controls">
        <span
          className="ctrl-btn"
          onClick={previous}
          style={{ display: "flex" }}
        >
          <IconPrev size={16} />
        </span>
        <span
          className="play-btn"
          onClick={togglePause}
          style={{ display: "flex" }}
        >
          {playback.playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </span>
        <span className="ctrl-btn" onClick={next} style={{ display: "flex" }}>
          <IconNext size={16} />
        </span>
      </div>

      <div className="mini-vol">
        <IconVolume size={13} />
        <div className="bar-track">
          <div
            className="bar-fill"
            style={{ width: `${deviceSettings.volume}%` }}
          />
        </div>
        <span className="num">{Math.round(deviceSettings.volume)}%</span>
      </div>
    </div>
  );
}
