import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import Toggle from "../components/Toggle";

const PROFILE_NAMES: Record<string, string> = {
  "profile-fps": "FPS",
  "profile-afrohouse": "Afro House",
  "profile-cinema": "Cinema",
};

export default function AppProfilesPage() {
  const { bindings, foregroundApp, profiles, saveAppSettings, appSettings } = useApp();

  return (
    <div className="page">
      <Panel title="ALTERNÂNCIA AUTOMÁTICA DE PERFIL">
        <p className="page-lead" style={{ marginBottom: 16 }}>
          O SoundCore observa a janela em primeiro plano. Quando um executável vinculado tem foco,
          o perfil dele é aplicado automaticamente — Spotify para música, VALORANT para FPS, VLC
          para cinema.
        </p>

        <div style={{ marginBottom: 16 }}>
          <Toggle
            label="Habilitar alternância automática de perfil"
            checked={appSettings.profileAutoSwitch}
            onChange={(v) => saveAppSettings({ profileAutoSwitch: v })}
          />
        </div>

        <div className="box" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "rgba(34,197,94,0.3)", background: "var(--accent-soft)" }}>
          <span className="status-dot" />
          <span style={{ fontSize: 12.5 }}>Aplicativo em foco:</span>
          <span className="num" style={{ fontSize: 12.5, color: "var(--accent-2)" }}>{foregroundApp || "desconhecido.exe"}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
            →{" "}
            {PROFILE_NAMES[
              bindings.find((b) => b.app.toLowerCase() === (foregroundApp ?? "").toLowerCase())
                ?.profileId ?? ""
            ] ?? "Sem vínculo"}
          </span>
        </div>
      </Panel>

      <Panel title="VÍNCULOS">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bindings.map((b) => (
            <div key={b.app} className="box" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: b.enabled ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="num" style={{ fontSize: 12.5 }}>{b.app}</span>
                <span className="badge">→ {PROFILE_NAMES[b.profileId] ?? b.profileId}</span>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{b.enabled ? "ativo" : "desativado"}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 14, fontSize: 11, color: "var(--text-faint)" }}>
          Perfis disponíveis: {profiles.map((p) => p.name).join(", ")}
        </p>
      </Panel>
    </div>
  );
}
