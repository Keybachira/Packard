import { useCallback, useEffect, useState } from "react";
import Panel from "../components/Panel";
import {
  IconCheck,
  IconHeart,
  IconMic,
  IconPlay,
  IconPlus,
  IconTrash,
  IconX,
} from "../components/icons";
import { useApp } from "../context/AppStore";
import {
  addRecognizedToLibrary,
  clearRecognitionHistory,
  getRecognitionHistory,
  recognizeFromMicrophone,
} from "../lib/deviceApi";
import type { RecognitionEntry, RecognitionResult } from "../types/audio";

function formatConfidence(score: number) {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

export default function RecognitionPage() {
  const { library, playTrack, favorite, getArt, notify } = useApp();
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [history, setHistory] = useState<RecognitionEntry[]>([]);
  const [art, setArt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getRecognitionHistory());
    } catch {
      /* keep current list */
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;
    setArt(null);
    const trackId = result?.matched ? result.track?.id ?? null : null;
    if (trackId) {
      getArt(trackId).then((a) => {
        if (!cancelled) setArt(a);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [result?.track?.id, result?.matched, getArt]);

  const handleRecognize = async () => {
    if (recognizing) return;
    setRecognizing(true);
    setResult(null);
    setSaveName("");
    setSavedTitle(null);
    try {
      const res = await recognizeFromMicrophone();
      setResult(res);
      notify(
        res.matched && res.track
          ? `Música identificada: ${res.track.title} — ${res.track.artist}`
          : "Nenhuma correspondência confiável encontrada.",
        res.matched ? "success" : "info",
      );
      loadHistory();
    } catch (e) {
      setResult(null);
      notify(`Falha ao reconhecer: ${e}`, "error");
    } finally {
      setRecognizing(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearRecognitionHistory();
      setHistory([]);
      notify("Histórico de reconhecimento limpo.", "success");
    } catch (e) {
      notify(`Falha ao limpar histórico: ${e}`, "error");
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const track = await addRecognizedToLibrary(saveName.trim() || undefined);
      setSavedTitle(track.title);
      notify(`Guardada na biblioteca: ${track.title}`, "success");
    } catch (e) {
      notify(`Falha ao guardar na biblioteca: ${e}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const matchedTrack = result?.matched ? result.track ?? null : null;

  return (
    <div className="page">
      <Panel
        title="RECONHECIMENTO DE MÚSICA"
        action={
          recognizing ? (
            <div className="rec-bars" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null
        }
      >
        <p className="page-lead" style={{ marginBottom: 20 }}>
          O aplicativo grava cerca de 8 segundos com o microfone padrão do Windows, calcula a
          impressão digital de áudio do trecho e a compara com as faixas da sua biblioteca.
          Aponte o microfone para a música ou deixe o som tocando e toque em Reconhecer.
        </p>

        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <button
            className={`btn-cta rec-mic-btn${recognizing ? " listening" : ""}`}
            onClick={handleRecognize}
            disabled={recognizing}
            title="Reconhecer a música tocando"
          >
            <IconMic size={22} />
            <span style={{ marginLeft: 10 }}>
              {recognizing ? "OUVINDO…" : "RECONHECER"}
            </span>
          </button>
        </div>
        <p style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "var(--text-faint)" }}>
          {recognizing
            ? "Gravando 8s e comparando com a biblioteca…"
            : "Requer um microfone configurado como dispositivo padrão de gravação."}
        </p>
      </Panel>

      {result && (
        <Panel
          title="RESULTADO"
          action={
            <span className="num" style={{ fontSize: 11, color: matchedTrack ? "var(--accent-2)" : "var(--text-faint)" }}>
              CONFIANÇA {formatConfidence(result.confidence)}
            </span>
          }
        >
          {matchedTrack ? (
            <div className="rec-row">
              <div
                className="rec-art"
                style={{ width: 72, height: 72, background: "var(--accent-soft)" }}
              >
                {art ? (
                  <img src={art} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 22 }}>♫</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {matchedTrack.title}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                  {matchedTrack.artist}
                  {matchedTrack.album ? ` · ${matchedTrack.album}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="btn-ghost"
                  title="Reproduzir"
                  onClick={() => playTrack(matchedTrack.id)}
                >
                  <IconPlay size={14} />
                </button>
                <button
                  className={`btn-ghost${matchedTrack.favorite ? " active" : ""}`}
                  title={matchedTrack.favorite ? "Remover favorita" : "Adicionar favorita"}
                  onClick={() => favorite(matchedTrack.id)}
                >
                  <IconHeart size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="box">
              <div className="box-label">Nenhuma correspondência</div>
              <div className="box-value num" style={{ fontSize: 12, lineHeight: 1.6 }}>
                O trecho gravado não correspondeu a nenhuma faixa da biblioteca com confiança
                suficiente (melhor score: {formatConfidence(result.confidence)}). Tente novamente
                com o som mais limpo ou mais próximo do microfone.
              </div>

              {savedTitle ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                    fontSize: 12.5,
                    color: "var(--accent-2)",
                  }}
                >
                  <IconCheck size={14} strokeWidth={2.4} />
                  Guardada como “{savedTitle}” — verás na aba Biblioteca.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Nome da faixa (opcional)"
                    disabled={saving}
                    style={{ flex: 1, minWidth: 0 }}
                    className="rec-name-input"
                  />
                  <button
                    className="btn-ghost"
                    onClick={handleSave}
                    disabled={saving}
                    title="Guardar o trecho gravado como faixa na biblioteca"
                  >
                    <IconPlus size={14} />
                    <span style={{ marginLeft: 6 }}>
                      {saving ? "A GUARDAR…" : "GUARDAR NA BIBLIOTECA"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </Panel>
      )}

      <Panel
        title="HISTÓRICO"
        action={
          history.length > 0 ? (
            <button className="btn-ghost" onClick={handleClear} title="Limpar histórico">
              <IconTrash size={13} />
            </button>
          ) : null
        }
      >
        {history.length === 0 ? (
          <p style={{ padding: "18px 0", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>
            Nenhum reconhecimento ainda. Toque em Reconhecer para começar.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((entry) => {
              const resolved = entry.matchedTrackId
                ? library.find((t) => t.id === entry.matchedTrackId) ?? null
                : null;
              const time = new Date(entry.timestampMs).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div key={entry.id} className="rec-row" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: entry.matchedTrackId ? "var(--accent-soft)" : "var(--surface-2)",
                      color: entry.matchedTrackId ? "var(--accent-2)" : "var(--text-faint)",
                    }}
                  >
                    {entry.matchedTrackId ? <IconCheck size={12} strokeWidth={2.4} /> : <IconX size={12} strokeWidth={2} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {resolved ? resolved.title : entry.title ?? "Não identificada"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {resolved ? resolved.artist : entry.artist ?? "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="num" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {formatConfidence(entry.confidence)}
                    </span>
                    <span className="num" style={{ fontSize: 11, color: "var(--text-faint)", minWidth: 44 }}>
                      {time}
                    </span>
                    {resolved && (
                      <button
                        className="btn-ghost"
                        title="Reproduzir"
                        onClick={() => playTrack(resolved.id)}
                      >
                        <IconPlay size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
