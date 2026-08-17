import { useEffect, useMemo, useState } from "react";
import type { Track } from "../../types/audio";
import { formatTime } from "../../lib/format";
import { gradientFor } from "./data";
import {
  IconInfo,
  IconLyrics,
  IconNote,
  IconQueue,
  IconTrash,
} from "../icons";

type PaneTab = "info" | "queue" | "lyrics";

interface Props {
  library: Track[];
  queue: Track[];
  current: Track | null;
  playing: boolean;
  onPlay: (id: string) => void;
  onTogglePause: () => void;
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  getArt: (id: string) => Promise<string | null>;
}

function useArt(trackId: string | null, getArt: (id: string) => Promise<string | null>) {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setArt(null);
    if (!trackId) return;
    getArt(trackId)
      .then((a) => {
        if (alive) setArt(a);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trackId, getArt]);
  return art;
}

function InfoTab({
  current,
  getArt,
}: {
  current: Track | null;
  getArt: (id: string) => Promise<string | null>;
}) {
  const art = useArt(current?.id ?? null, getArt);
  if (!current) {
    return (
      <div className="lyrics-empty">
        <IconNote size={42} />
        <p>Nenhuma faixa tocando. Escolha uma música na biblioteca.</p>
      </div>
    );
  }
  return (
    <div>
      <div
        className="info-current-art"
        style={
          art
            ? undefined
            : { background: gradientFor(`${current.title}${current.artist}`) }
        }
      >
        {art ? (
          <img src={art} alt={current.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <IconNote size={56} />
        )}
      </div>
      <div className="info-current-title">{current.title}</div>
      <div className="info-current-sub">{current.artist}</div>
      <div className="info-rows">
        <div className="info-row">
          <span className="k">Álbum</span>
          <span className="v">{current.album || "—"}</span>
        </div>
        <div className="info-row">
          <span className="k">Duração</span>
          <span className="v">{formatTime(current.durationSecs)}</span>
        </div>
        <div className="info-row">
          <span className="k">Favorita</span>
          <span className="v">
            {current.favorite ? "Sim" : "Não"}
          </span>
        </div>
      </div>
    </div>
  );
}

function QueueTab({
  queue,
  current,
  playing,
  onPlay,
  onTogglePause,
  onReorder,
  onRemove,
}: {
  queue: Track[];
  current: Track | null;
  playing: boolean;
  onPlay: (id: string) => void;
  onTogglePause: () => void;
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = queue.findIndex((t) => t.id === dragId);
    const to = queue.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    setDragId(null);
    onReorder(from, to);
  };

  if (queue.length === 0) {
    return (
      <div className="lyrics-empty">
        <IconQueue size={42} />
        <p>A fila está vazia.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="queue-head">
        <span className="q-title">Fila de reprodução</span>
        <span className="q-count">{queue.length} faixa(s)</span>
      </div>
      {queue.map((t, i) => {
        const isCurrent = current?.id === t.id;
        return (
          <div
            key={t.id}
            className={`queue-item${isCurrent ? " playing" : ""}${dragId === t.id ? " dragging" : ""}`}
            draggable
            onDragStart={() => setDragId(t.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(t.id)}
            onClick={() => (isCurrent ? onTogglePause() : onPlay(t.id))}
            data-queue-item-id={t.id}
          >
            <span className="q-num">{isCurrent && playing ? "▶" : i + 1}</span>
            <span className="q-meta">
              <span className="q-name">{t.title}</span>
              <br />
              <span className="q-artist">{t.artist}</span>
            </span>
            <span className="q-dur">{formatTime(t.durationSecs)}</span>
            <button
              className="q-remove"
              title="Remover da fila"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(t.id);
              }}
            >
              <IconTrash size={13} />
            </button>
            <span className="q-grip">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="9" cy="6" r="1.3" />
                <circle cx="15" cy="6" r="1.3" />
                <circle cx="9" cy="12" r="1.3" />
                <circle cx="15" cy="12" r="1.3" />
                <circle cx="9" cy="18" r="1.3" />
                <circle cx="15" cy="18" r="1.3" />
              </svg>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LyricsTab({ current }: { current: Track | null }) {
  return (
    <div className="lyrics-empty">
      <IconLyrics size={42} />
      <p>
        {current
          ? "Letras não disponíveis para esta faixa."
          : "Nenhuma faixa tocando para exibir letras."}
      </p>
    </div>
  );
}

export default function SidePane({
  library,
  queue,
  current,
  playing,
  onPlay,
  onTogglePause,
  onReorder,
  onRemove,
  getArt,
}: Props) {
  const [tab, setTab] = useState<PaneTab>("queue");
  const currentTrack = useMemo(
    () => (current ? library.find((t) => t.id === current.id) ?? null : null),
    [library, current],
  );

  return (
    <aside className="side-pane">
      <div className="side-pane-tabs">
        <button
          className={`side-pane-tab${tab === "info" ? " active" : ""}`}
          onClick={() => setTab("info")}
        >
          <IconInfo size={14} />
          Info
        </button>
        <button
          className={`side-pane-tab${tab === "queue" ? " active" : ""}`}
          onClick={() => setTab("queue")}
        >
          <IconQueue size={14} />
          Fila
        </button>
        <button
          className={`side-pane-tab${tab === "lyrics" ? " active" : ""}`}
          onClick={() => setTab("lyrics")}
        >
          <IconLyrics size={14} />
          Letras
        </button>
      </div>
      <div className="side-pane-body">
        {tab === "info" && <InfoTab current={currentTrack} getArt={getArt} />}
        {tab === "queue" && (
          <QueueTab
            queue={queue}
            current={currentTrack}
            playing={playing}
            onPlay={onPlay}
            onTogglePause={onTogglePause}
            onReorder={onReorder}
            onRemove={onRemove}
          />
        )}
        {tab === "lyrics" && <LyricsTab current={currentTrack} />}
      </div>
    </aside>
  );
}