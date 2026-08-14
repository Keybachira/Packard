import { useMemo } from "react";
import { useApp } from "../context/AppStore";
import {
  IconHeart,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconShuffle,
  IconVolume,
  IconVolumeX,
} from "./icons";
import ProgressBar from "./ProgressBar";

export default function PlayerBar() {
  const {
    playback,
    library,
    togglePause,
    next,
    previous,
    favorite,
    deviceSettings,
    onVolume,
    onMute,
  } = useApp();
  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  const position = playback.positionSecs;

  return (
    <div className="player-bar">
      <div className="pb-track">
        <div
          className="pb-art"
          style={{ background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <span style={{ fontSize: 18 }}>♫</span>
        </div>
        <div className="pb-meta">
          <div className="t">{current?.title ?? "Nada tocando"}</div>
          <div className="s">{current?.artist ?? "—"}</div>
        </div>
        <span
          className={`pb-icon ${current?.favorite ? "" : ""}`}
          onClick={() => current && favorite(current.id)}
          style={{ color: current?.favorite ? "var(--accent-2)" : undefined }}
        >
          <IconHeart size={17} />
        </span>
      </div>

      <div className="pb-center">
        <div className="pb-controls">
          <span className="pb-icon" style={{ color: playback.shuffle ? "var(--accent-2)" : undefined }}>
            <IconShuffle size={16} />
          </span>
          <span className="pb-icon" onClick={previous} style={{ display: "flex" }}>
            <IconPrev size={18} />
          </span>
          <span
            className="play-btn"
            onClick={togglePause}
            style={{ display: "flex", width: 40, height: 40 }}
          >
            {playback.playing ? <IconPause size={18} /> : <IconPlay size={18} />}
          </span>
          <span className="pb-icon" onClick={next} style={{ display: "flex" }}>
            <IconNext size={18} />
          </span>
          <span className="pb-icon" style={{ color: playback.repeat ? "var(--accent-2)" : undefined }}>
            <IconRepeat size={16} />
          </span>
        </div>
        <div className="pb-progress">
          <ProgressBar position={position} duration={current?.durationSecs ?? 0} />
        </div>
      </div>

      <div className="pb-right">
        <span className="pb-icon" style={{ display: "flex" }} onClick={() => onMute(!deviceSettings.muted)}>
          {deviceSettings.muted ? <IconVolumeX size={18} /> : <IconVolume size={18} />}
        </span>
        <div className="pb-vol">
          <div
            className="bar-track"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              onVolume(Math.round(Math.max(0, Math.min(100, ratio * 100))));
            }}
          >
            <div
              className="bar-fill"
              style={{ width: `${deviceSettings.muted ? 0 : deviceSettings.volume}%` }}
            />
          </div>
          <span className="num" style={{ fontSize: 11, color: "var(--text-faint)", width: 30, textAlign: "right" }}>
            {deviceSettings.muted ? "0%" : `${Math.round(deviceSettings.volume)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
