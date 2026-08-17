import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppStore";
import { EQ_BANDS, type Profile } from "../types/audio";
import VolumeKnob from "../components/VolumeKnob";
import EqBand from "../components/EqBand";
import {
  IconArrowRight,
  IconBell,
  IconGauge,
  IconHeadphones,
  IconMic,
  IconMore,
  IconMusic,
  IconPulse,
  IconSliders,
  IconSpeaker,
  IconWaves,
  iconForConnection,
  connectionLabel,
} from "../components/icons";
import { getSpectrum } from "../lib/deviceApi";

const ANALYZER_BARS = 40;

export default function HomePage() {
  const {
    devices,
    selected,
    selectedId,
    selectDevice,
    deviceSettings,
    onVolume,
    onMute,
    onEq,
    onPreset,
    audioLab,
    setAudioLab,
    calibrating,
    runCalibration,
    calibration,
    profiles,
    library,
    playlists,
    setSection,
    notify,
  } = useApp();

  const [spectrum, setSpectrum] = useState<number[]>(Array(ANALYZER_BARS).fill(0.1));

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const bins = await getSpectrum();
        setSpectrum((prev) =>
          bins.map((v, i) => {
            const prevV = prev[Math.floor((i / bins.length) * prev.length)] ?? v;
            return prevV + (v - prevV) * 0.3;
          }),
        );
      } catch {
        // keep last
      }
    }, 120);
    return () => clearInterval(id);
  }, []);

  const applyProfile = (p: Profile) => {
    setAudioLab({ bass: p.bass, treble: p.treble, spatial: p.spatial, loudness: p.loudness });
    notify(`Perfil "${p.name}" aplicado`);
  };

  const activeProfile = useMemo(() => profiles[0] ?? null, [profiles]);

  return (
    <div className="grid" style={{ display: "grid", gap: 16 }}>
      {/* FLB stat cards */}
      <div className="stats">
        {[
          { label: "Dispositivos", value: devices.length, icon: <IconSpeaker size={18} />, onClick: () => setSection("devices") },
          { label: "Faixas", value: library.length, icon: <IconMusic size={18} />, onClick: () => setSection("library") },
          { label: "Playlists", value: playlists.length, icon: <IconHeadphones size={18} />, onClick: () => setSection("library") },
          { label: "Perfis", value: profiles.length, icon: <IconSliders size={18} />, onClick: () => setSection("profiles") },
        ].map((s) => (
          <div className="stat-card" key={s.label} onClick={s.onClick}>
            <span className="stat-ic">{s.icon}</span>
            <div className="stat-num num">{s.value}</div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Device + Volume + Analyzer */}
      <div className="grid grid-3">
        <div className="card">
          <div className="card-head">
            <span className="eyebrow">DISPOSITIVO ATIVO</span>
            <span
              className="analyzer-select"
              onClick={() => setSection("devices")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <IconMore size={14} />
              Ver todos
            </span>
          </div>
          <div className="device-name">{selected?.name ?? "Nenhum dispositivo"}</div>
          <div className="status-row">
            <span className="status-dot" />
            {selected?.connected ? "Conectado" : "Desconectado"}
            {selected && ` · ${connectionLabel(selected.connection)}`}
          </div>
          <div className="bezel">
            <div className="device-img bezel-core">
              <div className="soundbar">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
          </div>
          <div className="spec-row">
            <div className="spec">
              <div className="k">VOLUME</div>
              <div className="v num">{Math.round(deviceSettings.volume)}%</div>
            </div>
            <div className="spec">
              <div className="k">BALANCE</div>
              <div className="v num">0dB</div>
            </div>
            <div className="spec">
              <div className="k">DINÂMICA</div>
              <div className="v num">{audioLab.limiter ? "ON" : "OFF"}</div>
            </div>
          </div>
          <button className="btn-outline" onClick={() => setSection("devices")}>
            Gerenciar Dispositivo
          </button>
        </div>

        <div className="card vol-card">
          <div className="card-head" style={{ width: "100%" }}>
            <span className="eyebrow">VOLUME MASTER</span>
          </div>
          <div className="vol-pct num">{deviceSettings.muted ? 0 : Math.round(deviceSettings.volume)}%</div>
          <VolumeKnob value={deviceSettings.volume} onChange={(v) => onVolume(v)} />
          <div className="knob-labels" style={{ width: 170 }}>
            <span>MIN</span>
            <span>MAX</span>
          </div>
          <button className="btn-mute" onClick={() => onMute(!deviceSettings.muted)}>
            <IconBell size={15} />
            {deviceSettings.muted ? "Desmutar" : "Silenciar"}
          </button>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="eyebrow">ANALISADOR EM TEMPO REAL</span>
            <span className="analyzer-select" onClick={() => setSection("analyzer")}>
              <IconPulse size={14} />
              Ver detalhes
            </span>
          </div>
          <div className="analyzer-body">
            <div className="db-axis">
              {["+12", "0", "-12", "-24", "-36"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="bars-wrap" style={{ height: 170 }}>
              {spectrum.map((v, i) => (
                <div
                  key={i}
                  className="abar"
                  style={{ height: `${Math.max(4, v * 100)}%`, animationDelay: `${i * 20}ms` }}
                />
              ))}
            </div>
          </div>
          <div className="freq-axis">
            {["20Hz", "100", "1K", "10K", "20K"].map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: EQ + Profile + Auto Calibration */}
      <div className="grid grid-3b">
        <div className="card">
          <div className="card-head">
            <span className="eyebrow">EQUALIZADOR AVANÇADO</span>
            <div className="eq-actions">
              <button
                className="btn-ghost"
                onClick={() => onPreset("FLAT")}
                disabled={!selected?.supportsEq}
              >
                Redefinir
              </button>
              <button className="btn-solid" onClick={() => setSection("audioLab")}>
                <IconSliders size={14} />
                Abrir Lab
              </button>
            </div>
          </div>
          <div className="eq-body">
            <div className="eq-axis">
              {["+12", "+6", "0", "-6", "-12"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="eq-sliders">
              {EQ_BANDS.map((band, i) => (
                <EqBand
                  key={band.frequency}
                  label={band.label}
                  value={deviceSettings.eq[i] ?? 0}
                  onChange={(v) => {
                    const next = [...deviceSettings.eq];
                    next[i] = v;
                    onEq(next);
                  }}
                  disabled={!selected?.supportsEq}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="eyebrow">PERFIL ATIVO</span>
            <span className="analyzer-select" onClick={() => setSection("profiles")}>
              <IconMore size={14} />
              Gerenciar
            </span>
          </div>
          {activeProfile ? (
            <>
              <div className="profile-head">
                <div>
                  <div className="profile-title">
                    <IconSpeaker size={18} style={{ color: "var(--accent-2)" }} />
                    {activeProfile.name}
                  </div>
                  <div className="profile-desc">{activeProfile.category}</div>
                </div>
                <div className="profile-art-wrap">
                  <img
                    className="profile-art-bg"
                    src={`https://picsum.photos/seed/${activeProfile.id}/132`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.visibility = "hidden";
                    }}
                    alt=""
                  />
                  <img
                    className="profile-art"
                    src={`https://picsum.photos/seed/${activeProfile.id}/132`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.visibility = "hidden";
                    }}
                    alt=""
                  />
                  <span className="profile-art-glint" />
                </div>
              </div>
              <div className="feat-grid">
                <div className="feat">
                  <span className="lbl">BASS</span>
                  <span className="val num">{activeProfile.bass > 0 ? "+" : ""}{activeProfile.bass}dB</span>
                </div>
                <div className="feat">
                  <span className="lbl">MID</span>
                  <span className="val num">{activeProfile.mids > 0 ? "+" : ""}{activeProfile.mids}dB</span>
                </div>
                <div className="feat">
                  <span className="lbl">TREBLE</span>
                  <span className="val num">{activeProfile.treble > 0 ? "+" : ""}{activeProfile.treble}dB</span>
                </div>
                <div className="feat">
                  <span className="lbl">SPATIAL</span>
                  <span className="val num">{activeProfile.spatial ? "ON" : "OFF"}</span>
                </div>
              </div>
              <button className="btn-outline" onClick={() => applyProfile(activeProfile)}>
                Aplicar perfil
              </button>
            </>
          ) : (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Nenhum perfil salvo.</p>
          )}
        </div>

        <div className="card calib-card">
          <div className="card-head" style={{ width: "100%" }}>
            <span className="eyebrow">AUTO CALIBRAÇÃO</span>
          </div>
          <div className="calib-ring">
            <div className="calib-mic">
              <IconMic size={26} />
            </div>
          </div>
          {calibrating ? (
            <>
              <div className="calib-status">CALIBRANDO...</div>
              <div className="calib-sub">Mantenha-se em silêncio por 30 segundos. Tons de varredura serão reproduzidos.</div>
            </>
          ) : calibration ? (
            <>
              <div className="calib-status">CALIBRADO</div>
              <div className="calib-sub">
                Curva corrigida aplicada · ressonância {calibration.bassResonanceHz}Hz · correção {calibration.correctionDb}dB
              </div>
            </>
          ) : (
            <>
              <div className="calib-status">PRONTO</div>
              <div className="calib-sub">Otimize o som para a sua sala. Leva ~30 segundos.</div>
            </>
          )}
          <button className="btn-cta" onClick={runCalibration} disabled={!selected?.connected}>
            {calibrating ? "Calibrando..." : "Iniciar Calibração"}
            <span className="btn-nested-icon">
              <IconArrowRight size={13} />
            </span>
          </button>
        </div>
      </div>

      {/* Row 3: Recognition + Shortcuts + Devices */}
      <div className="grid grid-3">
        <div className="card">
          <div className="card-head">
            <span className="eyebrow">RECONHECIMENTO DE MÚSICA</span>
          </div>
          <div className="recog-body">
            <div className="recog-ring">
              <IconMusic size={30} />
            </div>
            <div className="recog-text">
              <p>
                Identifique músicas que estão tocando. O reconhecimento usa o microfone do
                dispositivo.
              </p>
              <button className="btn-outline" style={{ width: "auto", padding: "8px 18px" }} disabled>
                Em breve
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="eyebrow">ATALHOS RÁPIDOS</span>
          </div>
          <div className="shortcut-grid">
            {[
              { icon: <IconPulse size={17} />, label: "EQ Plano" },
              { icon: <IconGauge size={17} />, label: "Modo Cinema" },
              { icon: <IconHeadphones size={17} />, label: "Modo Música" },
              { icon: <IconWaves size={17} />, label: "Redução de Ruído" },
            ].map((s) => (
              <div
                className="shortcut"
                key={s.label}
                onClick={() => {
                  if (s.label === "EQ Plano") onPreset("FLAT");
                  if (s.label === "Modo Cinema") onPreset("CINEMA");
                  if (s.label === "Modo Música") onPreset("MUSIC");
                  if (s.label === "Redução de Ruído") notify("Redução de ruído: máximo");
                }}
              >
                <span className="ic">{s.icon}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="eyebrow">DISPOSITIVOS</span>
            <span className="analyzer-select" onClick={() => setSection("devices")}>
              <IconMore size={14} />
              Ver todos
            </span>
          </div>
          {devices.length === 0 && (
            <p style={{ color: "var(--text-faint)", fontSize: 13, padding: "8px 0" }}>
              Nenhum dispositivo encontrado.
            </p>
          )}
          {devices.map((d) => (
            <div
              className="dev-row"
              key={d.id}
              onClick={() => selectDevice(d.id)}
              style={{ cursor: "pointer" }}
            >
              <div className={`dev-icon ${d.id === selectedId ? "on" : ""}`}>
                {iconForConnection(d.connection, { size: 18 })}
              </div>
              <div className="dev-info">
                <div className="n">{d.name}</div>
                <div className={`s ${d.connected ? "on" : ""}`}>
                  <span className="d" />
                  {d.connected ? "Conectado" : "Desconectado"}
                </div>
              </div>
              <span className="dev-more">
                <IconMore size={16} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
