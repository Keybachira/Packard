import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import Panel from "./Panel";
import { IconQrCode, IconRefresh, IconSmartphone, IconX } from "./icons";
import {
  disconnectAllRemotes,
  disconnectRemote,
  getRemoteState,
  regenerateRemoteSession,
} from "../lib/deviceApi";
import type { RemoteState } from "../types/audio";
import { useApp } from "../context/AppStore";

function fmtCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/// "agora", "42s", "3min" — how long a phone has been paired.
function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 5) return "agora";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min`;
}

export default function RemoteControlPanel() {
  const { notify } = useApp();
  const [state, setState] = useState<RemoteState | null>(null);
  const [busy, setBusy] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  // Ticks down every second between polls so the countdown reads smoothly
  // instead of jumping in 4s steps.
  const [displaySecs, setDisplaySecs] = useState(0);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getRemoteState();
      setState(s);
      setDisplaySecs(s.sessionExpiresIn);
    } catch (e) {
      // Silent: this polls in the background, no need to spam toasts.
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    // The backend also emits `remote::connected`/`remote::disconnected` the
    // instant a phone (dis)connects — listen for those so the panel updates
    // immediately instead of waiting for the next poll tick.
    const unlistenPromises = [
      listen("remote::connected", refresh),
      listen("remote::disconnected", refresh),
    ];
    pollRef.current = window.setInterval(refresh, 4000);
    tickRef.current = window.setInterval(() => {
      setDisplaySecs((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
      unlistenPromises.forEach((p) => p.then((un) => un()).catch(() => {}));
    };
  }, [refresh]);

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const s = await regenerateRemoteSession();
      setState(s);
      setDisplaySecs(s.sessionExpiresIn);
      notify("Novo QR Code gerado. Conexões anteriores foram encerradas.", "success");
    } catch (e) {
      notify(`Falha ao gerar novo QR Code: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectAll = async () => {
    setBusy(true);
    try {
      const s = await disconnectAllRemotes();
      setState(s);
      notify("Todos os controles remotos foram desconectados.");
    } catch (e) {
      notify(`Falha ao desconectar remotos: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectOne = async (id: string) => {
    setKickingId(id);
    try {
      const s = await disconnectRemote(id);
      setState(s);
      notify("Controle remoto desconectado.");
    } catch (e) {
      notify(`Falha ao desconectar: ${e}`, "error");
    } finally {
      setKickingId(null);
    }
  };

  return (
    <Panel
      title="CONTROLE REMOTO"
      action={
        state && state.connectedCount > 0 ? (
          <span className="remote-badge">
            <IconSmartphone size={13} />
            {state.connectedCount}/{state.maxRemotes}
          </span>
        ) : undefined
      }
    >
      <p className="page-lead" style={{ marginBottom: 14 }}>
        Escaneie o QR Code com o celular (mesma rede Wi-Fi) para controlar volume,
        reprodução e mudo direto do bolso.
      </p>

      {!state ? (
        <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Carregando…</p>
      ) : !state.ready ? (
        <div className="box" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <IconQrCode size={22} className="remote-qr-icon-dim" />
          <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>
            Aguardando rede local disponível para iniciar o servidor de controle
            remoto…
          </p>
        </div>
      ) : (
        <>
          <div className="remote-grid">
            <div className="remote-qr-box">
              {state.qrSvg ? (
                <div
                  className="remote-qr-svg"
                  dangerouslySetInnerHTML={{ __html: state.qrSvg }}
                />
              ) : (
                <IconQrCode size={64} className="remote-qr-icon-dim" />
              )}
            </div>

            <div className="remote-info">
              <div className="remote-info-row">
                <span className="field-label">Endereço</span>
                <span className="num remote-url">{state.url}</span>
              </div>
              <div className="remote-info-row">
                <span className="field-label">QR expira em</span>
                <span
                  className={`num ${displaySecs > 0 && displaySecs <= 30 ? "remote-expiring" : ""}`}
                >
                  {fmtCountdown(displaySecs)}
                </span>
              </div>
              <div className="remote-info-row">
                <span className="field-label">Conectados</span>
                <span className="num">
                  {state.connectedCount} / {state.maxRemotes}
                </span>
              </div>

              <div className="remote-actions">
                <button className="btn-ghost" onClick={handleRegenerate} disabled={busy}>
                  <IconRefresh size={14} /> Gerar novo QR
                </button>
                <button
                  className="btn-ghost remote-danger"
                  onClick={handleDisconnectAll}
                  disabled={busy || state.connectedCount === 0}
                >
                  Desconectar todos
                </button>
              </div>
            </div>
          </div>

          {state.clients.length > 0 && (
            <div className="remote-clients">
              <span className="field-label">Controles conectados</span>
              <ul className="remote-client-list">
                {state.clients.map((c, i) => (
                  <li key={c.id} className="remote-client-row">
                    <span className="remote-client-dot" />
                    <span className="remote-client-name">Controle {i + 1}</span>
                    <span className="remote-client-time">
                      há {fmtDuration(c.connectedSecs)}
                    </span>
                    <button
                      className="remote-client-kick"
                      onClick={() => handleDisconnectOne(c.id)}
                      disabled={kickingId === c.id}
                      aria-label={`Desconectar Controle ${i + 1}`}
                      title="Desconectar"
                    >
                      <IconX size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
