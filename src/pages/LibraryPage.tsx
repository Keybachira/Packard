import { useMemo, useState } from "react";
import { useApp } from "../context/AppStore";
import { formatTime } from "../lib/format";
import Panel from "../components/Panel";

type Filter = "all" | "favorites" | "playlists";

export default function LibraryPage() {
  const { library, playlists, playTrack, favorite, playback } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "favorites") return library.filter((t) => t.favorite);
    if (filter === "playlists") {
      const pl = playlists.find((p) => p.id === activePlaylist);
      if (pl) return library.filter((t) => pl.trackIds.includes(t.id));
      return [];
    }
    return library;
  }, [library, filter, activePlaylist, playlists]);

  const artists = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of library) map.set(t.artist, (map.get(t.artist) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [library]);

  const totalSecs = library.reduce((s, t) => s + t.durationSecs, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        {(
          [
            ["all", "All Tracks"],
            ["favorites", "Favorites"],
            ["playlists", "Playlists"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-2 text-text-dim hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filter === "playlists" && (
        <div className="flex flex-wrap gap-2">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => setActivePlaylist(pl.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                activePlaylist === pl.id
                  ? "border-accent text-accent"
                  : "border-border text-text-dim hover:text-text"
              }`}
            >
              {pl.name} · {pl.trackIds.length}
            </button>
          ))}
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_260px]">
        <Panel title={`Tracks · ${filtered.length}`} className="h-full">
          <div className="space-y-1">
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  t.id === playback.trackId
                    ? "border-accent/50 bg-accent/5"
                    : "border-transparent hover:border-border hover:bg-surface-2"
                }`}
              >
                <button
                  onClick={() => playTrack(t.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent transition-colors hover:bg-accent hover:text-black"
                  title="Play"
                >
                  {t.id === playback.trackId && playback.playing ? "❚❚" : "▶"}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text">{t.title}</p>
                  <p className="truncate text-[10px] text-text-dim">
                    {t.artist} · {t.album}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-text-dim">{formatTime(t.durationSecs)}</span>
                <button
                  onClick={() => favorite(t.id)}
                  className={`px-1 text-sm transition-colors ${
                    t.favorite ? "text-accent" : "text-text-dim/50 hover:text-text"
                  }`}
                  title={t.favorite ? "Remove favorite" : "Add favorite"}
                >
                  ♥
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Artists">
            <div className="space-y-2">
              {artists.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="truncate text-text">{name}</span>
                  <span className="font-mono text-[10px] text-text-dim">{count}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Library">
            <div className="space-y-1 text-xs text-text-dim">
              <p className="flex justify-between">
                <span>Tracks</span>
                <span className="font-mono text-text">{library.length}</span>
              </p>
              <p className="flex justify-between">
                <span>Playlists</span>
                <span className="font-mono text-text">{playlists.length}</span>
              </p>
              <p className="flex justify-between">
                <span>Duration</span>
                <span className="font-mono text-text">{formatTime(totalSecs)}</span>
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}