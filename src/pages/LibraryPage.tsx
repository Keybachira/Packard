import { useMemo, useState } from "react";
import { useApp } from "../context/AppStore";
import { formatTime } from "../lib/format";
import Panel from "../components/Panel";
import { IconHeart, IconPause, IconPlay } from "../components/icons";

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
    <div className="page">
      <div className="tabs">
        {(
          [
            ["all", "Todas as Faixas"],
            ["favorites", "Favoritas"],
            ["playlists", "Playlists"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <span key={id} className={`tab ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
            {label}
          </span>
        ))}
      </div>

      {filter === "playlists" && (
        <div className="tabs">
          {playlists.map((pl) => (
            <span
              key={pl.id}
              className={`tab ${activePlaylist === pl.id ? "active" : ""}`}
              onClick={() => setActivePlaylist(pl.id)}
            >
              {pl.name} · {pl.trackIds.length}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-3b">
        <Panel title={`FAIXAS · ${filtered.length}`}>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {filtered.map((t) => (
              <div key={t.id} className={`track-row ${t.id === playback.trackId ? "active" : ""}`}>
                <span className="track-play" onClick={() => playTrack(t.id)} style={{ cursor: "pointer" }}>
                  {t.id === playback.trackId && playback.playing ? <IconPause size={13} /> : <IconPlay size={13} />}
                </span>
                <div className="track-info" onClick={() => playTrack(t.id)} style={{ cursor: "pointer" }}>
                  <div className="t">{t.title}</div>
                  <div className="s">
                    {t.artist} · {t.album}
                  </div>
                </div>
                <span className="track-time num">{formatTime(t.durationSecs)}</span>
                <span
                  className={`track-fav ${t.favorite ? "active" : ""}`}
                  onClick={() => favorite(t.id)}
                  title={t.favorite ? "Remover favorita" : "Adicionar aos favoritos"}
                >
                  <IconHeart size={15} />
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <p style={{ color: "var(--text-faint)", fontSize: 12.5, padding: "18px 4px" }}>
                Nenhuma faixa nesta seleção.
              </p>
            )}
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="ARTISTAS">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {artists.map(([name, count]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span className="num" style={{ color: "var(--text-faint)", fontSize: 11 }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="BIBLIOTECA">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "var(--text-dim)" }}>
              <p style={{ display: "flex", justifyContent: "space-between", margin: 0 }}>
                <span>Faixas</span>
                <span className="num" style={{ color: "var(--text)" }}>{library.length}</span>
              </p>
              <p style={{ display: "flex", justifyContent: "space-between", margin: 0 }}>
                <span>Playlists</span>
                <span className="num" style={{ color: "var(--text)" }}>{playlists.length}</span>
              </p>
              <p style={{ display: "flex", justifyContent: "space-between", margin: 0 }}>
                <span>Duração</span>
                <span className="num" style={{ color: "var(--text)" }}>{formatTime(totalSecs)}</span>
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
