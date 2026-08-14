import { useState } from "react";
import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import Toggle from "../components/Toggle";

const CATEGORY_CLASS: Record<string, string> = {
  gaming: "gaming",
  music: "music",
  movie: "movie",
};

export default function ProfilesPage() {
  const { profiles, setAudioLab } = useApp();
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const apply = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setAudioLab({
      bass: p.bass,
      treble: p.treble,
      spatial: p.spatial,
      loudness: p.loudness,
    });
    setActive(id);
  };

  return (
    <div className="page">
      <p className="page-lead">
        Salve instantâneos de DSP por caso de uso. Ative um perfil para enviar suas configurações
        ao Audio Lab — ou deixe os Perfis de Aplicativos alternarem automaticamente pelo aplicativo
        em execução.
      </p>

      <div className="grid grid-cols-3">
        {profiles.map((p) => {
          const isActive = active === p.id;
          const isEditing = editing === p.id;
          return (
            <Panel
              key={p.id}
              title={p.name}
              action={<span className={`cat-tag ${CATEGORY_CLASS[p.category] ?? ""}`}>{p.category}</span>}
            >
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Slider label="Graves" value={p.bass} min={-6} max={6} unit="dB" onChange={() => {}} />
                  <Slider label="Médios" value={p.mids} min={-6} max={6} unit="dB" onChange={() => {}} />
                  <Slider label="Agudos" value={p.treble} min={-6} max={6} unit="dB" onChange={() => {}} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Toggle label="Espacial" checked={p.spatial} onChange={() => {}} />
                    <Toggle label="Loudness" checked={p.loudness} onChange={() => {}} />
                  </div>
                  <button className="btn-ghost" onClick={() => setEditing(null)}>
                    Concluir
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="feat-grid">
                    <div className="feat">
                      <span className="lbl">BASS</span>
                      <span className="val num">{p.bass > 0 ? "+" : ""}{p.bass} dB</span>
                    </div>
                    <div className="feat">
                      <span className="lbl">MID</span>
                      <span className="val num">{p.mids > 0 ? "+" : ""}{p.mids} dB</span>
                    </div>
                    <div className="feat">
                      <span className="lbl">TREBLE</span>
                      <span className="val num">{p.treble > 0 ? "+" : ""}{p.treble} dB</span>
                    </div>
                    <div className="feat">
                      <span className="lbl">ESPACIAL</span>
                      <span className="val num">{p.spatial ? "ON" : "OFF"}</span>
                    </div>
                  </div>
                  <span className={`badge ${p.loudness ? "on" : ""}`} style={{ alignSelf: "flex-start" }}>
                    LOUDNESS {p.loudness ? "ON" : "OFF"}
                  </span>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      className={isActive ? "btn-solid" : "btn-outline"}
                      style={{ width: "auto", padding: "9px 16px", marginTop: 0 }}
                      onClick={() => apply(p.id)}
                    >
                      {isActive ? "Ativo" : "Aplicar"}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setEditing(p.id)}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
