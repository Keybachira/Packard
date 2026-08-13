import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppStore";
import { formatTime } from "../lib/format";
import SpectrumAnalyzer from "../components/SpectrumAnalyzer";

export default function PlayerPage() {
  const { playback, library, playTrack, togglePause, next, previous } = useApp();
  const [playingTick, setPlayingTick] = useState(0);

  useEffect(() => {
    if (!playback.playing) return;
    const id = setInterval(() => setPlayingTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [playback.playing]);

  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  const position = playback.positionSecs + playingTick;

  const currentMinutes = current ? Math.floor(current.durationSecs / 60) : 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* Cover */}
        <div
          className="flex h-56 w-56 items-center justify-center rounded-2xl border border-border bg-surface-2"
          style={{ boxShadow: "0 0 80px -30px var(--color-accent)" }}
        >
          <span className="text-6xl text-accent">♫</span>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-text">{current?.title ?? "Nothing playing"}</h2>
          <p className="mt-1 text-sm text-text-dim">{current?.artist ?? "—"}</p>
          <p className="text-xs text-text-dim/70">{current?.album ?? ""}</p>
        </div>

        {/* Progress */}
        <div className="w-full max-w-md">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-text-dim">
            <span>{formatTime(position)}</span>
            <span>{formatTime(current?.durationSecs ?? 0)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={current?.durationSecs ?? 1}
            value={Math.min(position, current?.durationSecs ?? 1)}
            className="w-full"
            onChange={() => {}}
            disabled={!current}
          />
          <p className="mt-1 text-center text-[10px] text-text-dim">
            {currentMinutes} min track · {playback.shuffle ? "SHUFFLE" : "SEQ"}
          </p>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-3">
          <button
            onClick={previous}
            disabled={!current}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-text-dim transition-colors hover:text-text"
          >
            ⏮
          </button>
          <button
            onClick={togglePause}
            disabled={!current}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl text-black transition-transform hover:scale-105"
          >
            {playback.playing ? "❚❚" : "▶"}
          </button>
          <button
            onClick={next}
            disabled={!current}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-text-dim transition-colors hover:text-text"
          >
            ⏭
          </button>
        </div>
      </div>

      {/* Queue */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-dim">Queue</h3>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {library.map((t) => (
            <button
              key={t.id}
              onClick={() => playTrack(t.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                t.id === playback.trackId
                  ? "bg-accent/10 text-accent"
                  : "text-text-dim hover:bg-surface-2 hover:text-text"
              }`}
            >
              <span className="truncate">{t.title}</span>
              <span className="ml-3 font-mono text-[10px] text-text-dim/70">
                {formatTime(t.durationSecs)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <SpectrumAnalyzer running={playback.playing} />
    </div>
  );
}