import { useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppStore";
import {
  IconHeart,
  IconMusic,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconShuffle,
  IconSliders,
  IconVolume,
  IconVolumeX,
} from "./icons";
import { formatTime } from "../lib/format";

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
    setSection,
    notify,
  } = useApp();
  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  const duration = current?.durationSecs ?? 0;
  const position = playback.positionSecs;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const [shuffleOn, setShuffleOn] = useState(playback.shuffle);
  const [repeatOn, setRepeatOn] = useState(playback.repeat);

  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const seekRef = useRef<HTMLDivElement>(null);

  const onHover = (e: React.MouseEvent) => {
    if (!seekRef.current) return;
    const r = seekRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setHoverPct(ratio * 100);
  };

  return (
    <div className="player-bar playingPane">
      <div className="split">
        {/* LEFT: album art + track info */}
        <div className="left_pane_section">
          <div
            className="album_art"
            style={{
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 26 }}>♫</span>
          </div>
          <div className="track_info">
            <p className="track_title">{current?.title ?? "Nada tocando"}</p>
            <p className="track_artist">{current?.artist ?? "—"}</p>
          </div>
        </div>

        {/* CENTER: actions + track bar */}
        <div className="center_pane_section">
          <div className="t_actions">
            <button
              className={`iconBtn ${shuffleOn ? "activeBtn" : ""}`}
              title="Shuffle"
              onClick={() => {
                setShuffleOn((s) => !s);
                notify(shuffleOn ? "Shuffle Off" : "Shuffle On");
              }}
            >
              <IconShuffle size={18} />
            </button>
            <button
              className="iconBtn scale_icon"
              title="Anterior"
              onClick={previous}
            >
              <IconPrev size={18} />
            </button>
            <div
              id="toggle_play"
              className="iconsWrapper"
              onClick={togglePause}
            >
              {playback.playing ? (
                <IconPause size={26} />
              ) : (
                <IconPlay size={26} />
              )}
            </div>
            <button
              className="iconBtn scale_icon"
              title="Próxima"
              onClick={next}
            >
              <IconNext size={18} />
            </button>
            <button
              className={`iconBtn ${repeatOn ? "activeBtn" : ""}`}
              title="Repetir"
              onClick={() => {
                setRepeatOn((r) => !r);
                notify(repeatOn ? "Repeat Off" : "Repeat On");
              }}
            >
              <IconRepeat size={18} />
            </button>
          </div>
          <div className="TrackBar">
            <div className="progressInfoCard">
              <p>{formatTime(position)}</p>
              <p>{formatTime(duration)}</p>
            </div>
            <div
              className="seekBar"
              ref={seekRef}
              onMouseMove={onHover}
              onMouseLeave={() => setHoverPct(null)}
            >
              <div className="seekProgress" style={{ width: `${pct}%` }}>
                <div></div>
              </div>
              {hoverPct !== null && (
                <p id="hoverTime" style={{ left: `${hoverPct}%` }}>
                  {formatTime((hoverPct / 100) * duration)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: actions + volume rocker */}
      <div className="right_pane_section">
        <div className="flex gap20">
          <button
            className={`iconBtn smallBtn ${current?.favorite ? "activeBtn" : ""}`}
            title="Favorito"
            onClick={() => current && favorite(current.id)}
          >
            <IconHeart size={17} />
          </button>
          <button
            className="iconBtn smallBtn"
            title="Biblioteca"
            onClick={() => setSection("library")}
          >
            <IconMusic size={17} />
          </button>
          <button
            className="iconBtn smallBtn"
            title="Equalizador"
            onClick={() => setSection("audioLab")}
          >
            <IconSliders size={17} />
          </button>
          <button
            className="iconBtn smallBtn"
            title={deviceSettings.muted ? "Desmutar" : "Mudo"}
            onClick={() => onMute(!deviceSettings.muted)}
          >
            {deviceSettings.muted ? (
              <IconVolumeX size={17} />
            ) : (
              <IconVolume size={17} />
            )}
          </button>
        </div>
        <div className="vol_rocker">
          <span style={{ display: "flex" }}>
            {deviceSettings.muted ? (
              <IconVolumeX size={16} />
            ) : (
              <IconVolume size={16} />
            )}
          </span>
          <div
            className="VolumeRocker"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - r.left) / r.width;
              onVolume(Math.round(Math.max(0, Math.min(100, ratio * 100))));
            }}
          >
            <div
              className="base_slider_progress"
              style={{
                width: `${deviceSettings.muted ? 0 : deviceSettings.volume}%`,
              }}
            />
          </div>
          <span className="vol-num">
            {deviceSettings.muted ? "0" : Math.round(deviceSettings.volume)}
          </span>
        </div>
      </div>
    </div>
  );
}
