import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppStore";
import type { Track } from "../types/audio";
import TrackCard from "../components/MyMusic/TrackCard";
import GroupCard from "../components/MyMusic/GroupCard";
import FolderRow from "../components/MyMusic/FolderRow";
import MixCard from "../components/MyMusic/MixCard";
import TabsHeader, { type SortKey } from "../components/MyMusic/TabsHeader";
import TabSwitcher, { type MusicTab } from "../components/MyMusic/TabSwitcher";
import SidePane from "../components/MyMusic/SidePane";
import ContextMenu from "../components/MyMusic/ContextMenu";
import PlaylistPicker from "../components/MyMusic/PlaylistPicker";
import {
  groupAlbums,
  groupArtists,
  groupFolders,
  gradientFor,
  resolvePlaylist,
  type AlbumGroup,
  type ArtistGroup,
  type FolderGroup,
} from "../components/MyMusic/data";
import {
  IconAlbum,
  IconClock,
  IconFolderSvg,
  IconHeart,
  IconList,
  IconMusic,
  IconNote,
  IconPlay,
  IconPlus,
  IconTrash,
  IconUser,
  IconWaves,
} from "../components/icons";

type Drill =
  | { type: "album"; id: string }
  | { type: "artist"; id: string }
  | { type: "playlist"; id: string }
  | { type: "folder"; id: string }
  | null;

interface CtxState {
  x: number;
  y: number;
  track: Track;
}

function sortTracks(list: Track[], sort: SortKey): Track[] {
  const arr = [...list];
  switch (sort) {
    case "title":
      arr.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "artist":
      arr.sort(
        (a, b) =>
          a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      );
      break;
    case "album":
      arr.sort(
        (a, b) =>
          (a.album ?? "").localeCompare(b.album ?? "") ||
          a.title.localeCompare(b.title),
      );
      break;
    case "date":
    default:
      break;
  }
  return arr;
}

export default function PlayerPage() {
  const {
    library,
    playlists,
    queue,
    playback,
    playTrack,
    togglePause,
    favorite,
    notify,
    addLibraryFolder,
  } = useApp();

  const [tab, setTab] = useState<MusicTab>("home");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);
  const [drill, setDrill] = useState<Drill>(null);
  const [recents, setRecents] = useState<Track[]>([]);

  const current = useMemo(
    () => library.find((t) => t.id === playback.trackId) ?? null,
    [library, playback.trackId],
  );

  // Build a session-local "recently played" list for the Recents tab.
  useEffect(() => {
    if (!playback.trackId) return;
    const t = library.find((x) => x.id === playback.trackId);
    if (!t) return;
    setRecents((prev) => [t, ...prev.filter((x) => x.id !== t.id)].slice(0, 60));
  }, [playback.trackId, library]);

  const artists = useMemo(() => groupArtists(library), [library]);
  const albums = useMemo(() => groupAlbums(library), [library]);
  const folders = useMemo(() => groupFolders(library), [library]);

  const q = search.trim().toLowerCase();
  const matches = (t: Track) =>
    !q ||
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    (t.album ?? "").toLowerCase().includes(q);

  const filteredTracks = useMemo(
    () => sortTracks(library.filter(matches), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, q, sort],
  );

  const filteredRecents = useMemo(
    () => sortTracks(recents.filter(matches), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recents, q, sort],
  );

  const filteredArtists = useMemo(
    () => artists.filter((a) => a.name.toLowerCase().includes(q)),
    [artists, q],
  );
  const filteredAlbums = useMemo(
    () => albums.filter((a) => a.name.toLowerCase().includes(q)),
    [albums, q],
  );
  const filteredPlaylists = useMemo(
    () => playlists.filter((p) => p.name.toLowerCase().includes(q)),
    [playlists, q],
  );
  const filteredFolders = useMemo(
    () => folders.filter((f) => f.name.toLowerCase().includes(q)),
    [folders, q],
  );

  const drillTracks: Track[] = useMemo(() => {
    if (!drill) return [];
    const lookup = (id: string) => library.find((t) => t.id === id);
    if (drill.type === "playlist") return resolvePlaylist(playlists, library, drill.id);
    const src =
      drill.type === "artist"
        ? (artists.find((a) => a.id === drill.id) as ArtistGroup | undefined)
        : drill.type === "album"
          ? (albums.find((a) => a.id === drill.id) as AlbumGroup | undefined)
          : (folders.find((f) => f.id === drill.id) as FolderGroup | undefined);
    if (!src) return [];
    return src.trackIds.map(lookup).filter((t): t is Track => Boolean(t));
  }, [drill, library, artists, albums, folders, playlists]);

  const drillName = useMemo(() => {
    if (!drill) return "";
    if (drill.type === "playlist")
      return playlists.find((p) => p.id === drill.id)?.name ?? "";
    if (drill.type === "artist")
      return artists.find((a) => a.id === drill.id)?.name ?? "";
    if (drill.type === "album")
      return albums.find((a) => a.id === drill.id)?.name ?? "";
    return folders.find((f) => f.id === drill.id)?.name ?? "";
  }, [drill, playlists, artists, albums, folders]);

  const drillIcon =
    drill?.type === "album"
      ? IconAlbum
      : drill?.type === "artist"
        ? IconUser
        : drill?.type === "playlist"
          ? IconList
          : IconFolderSvg;

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setMultiSelect(false);
  };

  const playMany = (ids: string[]) => {
    if (ids.length) playTrack(ids[0]);
  };

  const onOpenCtx = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, track });
  };

  const addToPlaylist = (playlistId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    notify(pl ? `Adicionado a "${pl.name}"` : "Playlist não encontrada");
    setPickerTrack(null);
  };

  const removeFromPlaylist = () => {
    notify("Removido da playlist");
  };

  const isSelected = (id: string) => selected.has(id);

  const stats = [
    { label: "Faixas", value: library.length, icon: IconNote, tab: "tracks" as MusicTab },
    { label: "Playlists", value: playlists.length, icon: IconList, tab: "playlists" as MusicTab },
    { label: "Artistas", value: artists.length, icon: IconUser, tab: "artists" as MusicTab },
    { label: "Álbuns", value: albums.length, icon: IconAlbum, tab: "albums" as MusicTab },
  ];

  const favorites = useMemo(
    () => library.filter((t) => t.favorite),
    [library],
  );

  const mixes = useMemo(() => {
    const faves = favorites.slice(0, 12);
    const recent = library.slice(-12).reverse();
    const random = [...library].sort(() => Math.random() - 0.5).slice(0, 12);
    return [
      {
        id: "faves",
        name: "Mix de Favoritas",
        subtitle: `${faves.length} faixas`,
        icon: <IconHeart size={30} />,
        gradient: gradientFor("faves"),
        tracks: faves,
      },
      {
        id: "recent",
        name: "Recém Adicionadas",
        subtitle: `${recent.length} faixas`,
        icon: <IconClock size={30} />,
        gradient: gradientFor("recent"),
        tracks: recent,
      },
      {
        id: "random",
        name: "Descobertas",
        subtitle: `${random.length} faixas`,
        icon: <IconWaves size={30} />,
        gradient: gradientFor("random"),
        tracks: random,
      },
    ];
  }, [favorites, library]);

  const emptyState = (msg: string, action?: () => void, actionLabel?: string) => (
    <div className="mm-empty">
      <IconMusic size={44} />
      <p>{msg}</p>
      {action && actionLabel && (
        <button onClick={action}>{actionLabel}</button>
      )}
    </div>
  );

  const renderTrackList = (tracks: Track[]) => (
    <div className="track-list">
      {tracks.map((t, i) => (
        <TrackCard
          key={t.id}
          track={t}
          index={i}
          isPlaying={t.id === playback.trackId}
          isFavorite={t.favorite}
          selectable={multiSelect}
          selected={isSelected(t.id)}
          onPlay={playTrack}
          onTogglePause={togglePause}
          onFavorite={favorite}
          onSelect={toggleSelect}
          onContextMenu={onOpenCtx}
        />
      ))}
    </div>
  );

  const renderGrid = <T extends { id: string; name: string; subtitle: string; icon: React.ReactNode; gradient: string }>(
    items: T[],
    onClick: (item: T) => void,
    onPlay: (item: T) => void,
    emptyMsg: string,
  ) =>
    items.length === 0 ? (
      emptyState(emptyMsg)
    ) : (
      <div className="group-grid">
        {items.map((item) => (
          <GroupCard
            key={item.id}
            name={item.name}
            subtitle={item.subtitle}
            icon={item.icon}
            gradient={item.gradient}
            onClick={() => onClick(item)}
            onPlay={() => onPlay(item)}
          />
        ))}
      </div>
    );

  const renderHome = () => (
    <div className="home-tab">
      <div className="mm-section-title">
        <span>Biblioteca</span>
      </div>
      <div className="stats">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card" onClick={() => setTab(s.tab)}>
              <span className="stat-ic">
                <Icon size={20} />
              </span>
              <div className="stat-num">{s.value}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mm-section-title">
        <span>Mixes para você</span>
      </div>
      <div className="mix-row">
        {mixes.map((m) => (
          <MixCard
            key={m.id}
            name={m.name}
            subtitle={m.subtitle}
            icon={m.icon}
            gradient={m.gradient}
            onPlay={() => m.tracks[0] && playTrack(m.tracks[0].id)}
          />
        ))}
      </div>

      {favorites.length > 0 && (
        <>
          <div className="mm-section-title">
            <span>Favoritas</span>
            <button className="mm-more" onClick={() => setTab("tracks")}>
              Ver todas
            </button>
          </div>
          {renderTrackList(favorites.slice(0, 8))}
        </>
      )}
    </div>
  );

  const renderTracks = () =>
    filteredTracks.length === 0
      ? emptyState(
          q
            ? `Nada encontrado para "${search}".`
            : library.length === 0
              ? "Sua biblioteca está vazia. Adicione uma pasta de música para começar."
              : "Nenhuma faixa encontrada.",
          library.length === 0 ? addLibraryFolder : undefined,
          library.length === 0 ? "Adicionar pasta" : undefined,
        )
      : renderTrackList(filteredTracks);

  const renderRecents = () =>
    filteredRecents.length === 0
      ? emptyState(
          q
            ? `Nada encontrado para "${search}".`
            : "Nenhuma faixa reproduzida recentemente nesta sessão.",
        )
      : renderTrackList(filteredRecents);

  const renderPlaylists = () =>
    renderGrid(
      filteredPlaylists.map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: `${p.trackIds.length} faixas`,
        icon: <IconList size={30} />,
        gradient: gradientFor(p.name),
      })),
      (p) => setDrill({ type: "playlist", id: p.id }),
      (p) => {
        const ids = resolvePlaylist(playlists, library, p.id);
        playMany(ids.map((t) => t.id));
      },
      q ? `Nada encontrado para "${search}".` : "Nenhuma playlist criada ainda.",
    );

  const renderArtists = () =>
    renderGrid(
      filteredArtists.map((a) => ({
        id: a.id,
        name: a.name,
        subtitle: `${a.trackIds.length} faixas`,
        icon: <IconUser size={30} />,
        gradient: gradientFor(a.name),
      })),
      (a) => setDrill({ type: "artist", id: a.id }),
      (a) => {
        const ids = artists.find((x) => x.id === a.id)?.trackIds ?? [];
        playMany(ids);
      },
      q ? `Nada encontrado para "${search}".` : "Nenhum artista encontrado.",
    );

  const renderAlbums = () =>
    renderGrid(
      filteredAlbums.map((a) => ({
        id: a.id,
        name: a.name,
        subtitle: a.artist,
        icon: <IconAlbum size={30} />,
        gradient: gradientFor(a.name),
      })),
      (a) => setDrill({ type: "album", id: a.id }),
      (a) => {
        const ids = albums.find((x) => x.id === a.id)?.trackIds ?? [];
        playMany(ids);
      },
      q ? `Nada encontrado para "${search}".` : "Nenhum álbum encontrado.",
    );

  const renderFolders = () =>
    filteredFolders.length === 0 ? (
      emptyState(
        q
          ? `Nada encontrado para "${search}".`
          : "Nenhuma pasta encontrada. Suas faixas não têm caminhos de arquivo.",
      )
    ) : (
      <div className="folder-list">
        {filteredFolders.map((f) => (
          <FolderRow
            key={f.id}
            name={f.name}
            path={f.path}
            count={f.trackIds.length}
            onClick={() => setDrill({ type: "folder", id: f.id })}
          />
        ))}
      </div>
    );

  const renderDrill = () => {
    if (!drill) return null;
    const DrillIcon = drillIcon;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
        <div className="sliver-bar">
          <button className="sliver-back" onClick={() => setDrill(null)}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Voltar
          </button>
          <div
            className="sliver-art"
            style={{ background: gradientFor(drillName) }}
          >
            <DrillIcon size={30} />
          </div>
          <div className="sliver-info">
            <div className="sliver-type">
              {drill.type === "playlist"
                ? "Playlist"
                : drill.type === "artist"
                  ? "Artista"
                  : drill.type === "album"
                    ? "Álbum"
                    : "Pasta"}
            </div>
            <div className="sliver-name">{drillName}</div>
            <div className="sliver-sub">
              {drillTracks.length} faixa(s)
            </div>
          </div>
          <div className="sliver-actions">
            <button
              className="ms-action"
              style={{ color: "var(--accentColor)" }}
              onClick={() => playMany(drillTracks.map((t) => t.id))}
            >
              <IconPlay size={14} />
              Reproduzir
            </button>
          </div>
        </div>
        <div className="tabs-content" style={{ height: "auto", flex: 1 }}>
          {drillTracks.length === 0
            ? emptyState("Esta coleção está vazia.")
            : renderTrackList(drillTracks)}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (drill) return renderDrill();
    switch (tab) {
      case "home":
        return renderHome();
      case "tracks":
        return renderTracks();
      case "recents":
        return renderRecents();
      case "playlists":
        return renderPlaylists();
      case "artists":
        return renderArtists();
      case "albums":
        return renderAlbums();
      case "folders":
        return renderFolders();
    }
  };

  const counts: Partial<Record<MusicTab, number>> = {
    tracks: library.length,
    playlists: playlists.length,
    artists: artists.length,
    albums: albums.length,
    folders: folders.length,
  };

  return (
    <div className="my-music">
      <section id="tabsArea" className={multiSelect ? "multiSelectMode" : ""}>
        <TabsHeader
          search={search}
          onSearch={setSearch}
          sort={sort}
          onSort={setSort}
          multiSelect={multiSelect}
          onToggleMultiSelect={() => setMultiSelect((m) => !m)}
          selectedCount={selected.size}
          onClearSelection={clearSelection}
        />

        {multiSelect && (
          <div className="multi-select-bar">
            <span className="count">
              {selected.size} selecionado(s)
            </span>
            <span className="hint">Aplicar a:</span>
            <button
              className="ms-action"
              onClick={() => playMany([...selected])}
            >
              <IconPlay size={13} />
              Reproduzir
            </button>
            <button
              className="ms-action"
              onClick={() => {
                selected.forEach((id) => favorite(id));
                notify("Favoritos atualizados");
              }}
            >
              <IconHeart size={13} />
              Favoritar
            </button>
            <button
              className="ms-action"
              onClick={() => setPickerTrack(library.find((t) => selected.has(t.id)) ?? null)}
            >
              <IconPlus size={13} />
              Playlist
            </button>
            <button className="ms-action" onClick={() => setSelected(new Set())}>
              <IconTrash size={13} />
              Limpar
            </button>
          </div>
        )}

        {!drill && (
          <TabSwitcher tab={tab} onChange={setTab} counts={counts} />
        )}

        <div className="tabs-content">{renderContent()}</div>
      </section>

      <SidePane
        library={library}
        queue={queue}
        current={current}
        playing={playback.playing}
        onPlay={playTrack}
        onTogglePause={togglePause}
      />

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          track={ctx.track}
          isFavorite={ctx.track.favorite}
          inPlaylist={drill?.type === "playlist"}
          onPlay={() => {
            playTrack(ctx.track.id);
            setCtx(null);
          }}
          onAddToPlaylist={() => {
            setPickerTrack(ctx.track);
            setCtx(null);
          }}
          onFavorite={() => {
            favorite(ctx.track.id);
            setCtx(null);
          }}
          onRemoveFromPlaylist={() => {
            removeFromPlaylist();
            setCtx(null);
          }}
          onClose={() => setCtx(null)}
        />
      )}

      {pickerTrack && (
        <PlaylistPicker
          track={pickerTrack}
          playlists={playlists}
          library={library}
          onAdd={addToPlaylist}
          onClose={() => setPickerTrack(null)}
        />
      )}
    </div>
  );
}