import { useMemo } from "react";
import { useApp } from "../context/AppStore";
import { formatTime } from "../lib/format";
import Panel from "../components/Panel";
import ProgressBar from "../components/ProgressBar";
import SpectrumAnalyzer from "../components/SpectrumAnalyzer";
import { IconHeart, IconMusic, IconNext, IconPause, IconPlay, IconPrev } from "../components/icons";

export default function PlayerPage() {
  const { playback, library, playTrack, togglePause, next, previous, favorite } = useApp();

  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  const position = playback.positionSecs;

  return (
    <div className="page">
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "34px 20px" }}>
        <div className="bezel cover-lg-shell">
          <div className="cover-lg bezel-core">
            <IconMusic size={54} />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{current?.title ?? "Nada tocando"}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>{current?.artist ?? "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{current?.album ?? ""}</div>
        </div>

        <div style={{ width: "100%", maxWidth: 420 }}>
          <ProgressBar position={position} duration={current?.durationSecs ?? 0} />
          <p style={{ textAlign: "center", fontSize: 10.5, color: "var(--text-faint)", marginTop: 8 }}>
            {playback.shuffle ? "REPRODUÇÃO ALEATÓRIA" : "REPRODUÇÃO SEQUENCIAL"}
          </p>
        </div>

        <div className="transport-lg">
          <button className="transport-icon" onClick={previous} disabled={!current}>
            <IconPrev size={22} />
          </button>
          <button className="play-btn-lg" onClick={togglePause} disabled={!current}>
            {playback.playing ? <IconPause size={22} /> : <IconPlay size={22} />}
          </button>
          <button className="transport-icon" onClick={next} disabled={!current}>
            <IconNext size={22} />
          </button>
          <button
            className="transport-icon"
            onClick={() => current && favorite(current.id)}
            disabled={!current}
            style={{ color: current?.favorite ? "var(--accent-2)" : undefined }}
          >
            <IconHeart size={20} />
          </button>
        </div>
      </div>

      <Panel title={`FILA · ${library.length}`}>
        <div style={{ maxHeight: 230, overflowY: "auto" }}>
          {library.map((t) => (
            <div
              key={t.id}
              className={`track-row ${t.id === playback.trackId ? "active" : ""}`}
              onClick={() => playTrack(t.id)}
            >
              <span className="track-play">
                {t.id === playback.trackId && playback.playing ? <IconPause size={13} /> : <IconPlay size={13} />}
              </span>
              <div className="track-info">
                <div className="t">{t.title}</div>
                <div className="s">{t.artist}</div>
              </div>
              <span className="track-time num">{formatTime(t.durationSecs)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="ESPECTRO">
        <SpectrumAnalyzer running={playback.playing} />
      </Panel>
    </div>
  );
}
