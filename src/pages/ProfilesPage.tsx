import { useState } from "react";
import { useApp } from "../context/AppStore";
import type { Profile } from "../types/audio";
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
  const [drafts, setDrafts] = useState<Record<string, Profile>>({});

  const draft = (id: string): Profile => drafts[id] ?? profiles.find((x) => x.id === id)!;

  const startEdit = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...p } }));
    setEditing(id);
  };

  const patchDraft = (id: string, patch: Partial<Profile>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const apply = (id: string) => {
    const p = draft(id);
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
          const cur = draft(p.id);
          return (
            <Panel
              key={p.id}
              title={p.name}
              action={<span className={`cat-tag ${CATEGORY_CLASS[p.category] ?? ""}`}>{p.category}</span>}
            >
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Slider label="Graves" value={cur.bass} min={-6} max={6} unit="dB" onChange={(v) => patchDraft(p.id, { bass: v })} />
                  <Slider label="Médios" value={cur.mids} min={-6} max={6} unit="dB" onChange={(v) => patchDraft(p.id, { mids: v })} />
                  <Slider label="Agudos" value={cur.treble} min={-6} max={6} unit="dB" onChange={(v) => patchDraft(p.id, { treble: v })} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Toggle label="Espacial" checked={cur.spatial} onChange={(v) => patchDraft(p.id, { spatial: v })} />
                    <Toggle label="Loudness" checked={cur.loudness} onChange={(v) => patchDraft(p.id, { loudness: v })} />
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
                      <span className="val num">{cur.bass > 0 ? "+" : ""}{cur.bass} dB</span>
                    </div>
                    <div className="feat">
                      <span className="lbl">MID</span>
                      <span className="val num">{cur.mids > 0 ? "+" : ""}{cur.mids} dB</span>
                    </div>
                    <div className="feat">
                      <span className="lbl">TREBLE</span>
                      <span className="val num">{cur.treble > 0 ? "+" : ""}{cur.treble} dB</span>
                    </div>
                    <div className="feat">
                      <span className="lbl">ESPACIAL</span>
                      <span className="val num">{cur.spatial ? "ON" : "OFF"}</span>
                    </div>
                  </div>
                  <span className={`badge ${cur.loudness ? "on" : ""}`} style={{ alignSelf: "flex-start" }}>
                    LOUDNESS {cur.loudness ? "ON" : "OFF"}
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
                      onClick={() => startEdit(p.id)}
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
