import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import Toggle from "../components/Toggle";

export default function SettingsPage() {
  const { appSettings, saveAppSettings, devices, selectedId, selectDevice, notify, library, scanning, addLibraryFolder } = useApp();

  return (
    <div className="page">
      <Panel title="APARÊNCIA E IDIOMA">
        <div className="grid grid-2">
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Tema</div>
            <div className="tabs">
              {["dark", "light"].map((t) => (
                <span
                  key={t}
                  className={`tab ${appSettings.theme === t ? "active" : ""}`}
                  onClick={() => saveAppSettings({ theme: t })}
                >
                  {t === "dark" ? "Escuro" : "Claro"}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Idioma</div>
            <select
              value={appSettings.language}
              onChange={(e) => saveAppSettings({ language: e.target.value })}
              className="btn-ghost"
              style={{ width: "100%", textAlign: "left", fontWeight: 600 }}
            >
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="DISPOSITIVO PADRÃO">
        <p className="page-lead" style={{ marginBottom: 12 }}>
          Reconecta automaticamente a este dispositivo na inicialização.
        </p>
        <div className="tabs">
          {devices.map((d) => (
            <span
              key={d.id}
              className={`tab ${selectedId === d.id ? "active" : ""}`}
              onClick={() => {
                selectDevice(d.id);
                saveAppSettings({ lastDeviceId: d.id });
                notify(`Dispositivo padrão: ${d.name}`);
              }}
            >
              {d.name}
            </span>
          ))}
          {devices.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum dispositivo encontrado ainda.</p>
          )}
        </div>
      </Panel>

      <Panel title="INICIALIZAÇÃO E COMPORTAMENTO">
        <div className="grid grid-2">
          <div className="box" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Toggle
              label="Iniciar com o sistema"
              checked={appSettings.launchOnStartup}
              onChange={(v) => saveAppSettings({ launchOnStartup: v })}
            />
            <Toggle
              label="Minimizar para a bandeja"
              checked={appSettings.minimizeToTray}
              onChange={(v) => saveAppSettings({ minimizeToTray: v })}
            />
          </div>
          <div className="box" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Toggle
              label="Notificações"
              checked={appSettings.notifications}
              onChange={(v) => saveAppSettings({ notifications: v })}
            />
            <Toggle
              label="Verificar atualizações"
              checked={appSettings.checkUpdates}
              onChange={(v) => saveAppSettings({ checkUpdates: v })}
            />
          </div>
        </div>
      </Panel>

      <Panel title="ÁUDIO">
        <div className="grid grid-2">
          <Slider
            label="Barras do espectro"
            value={appSettings.spectrumBins}
            min={16}
            max={128}
            step={8}
            onChange={(spectrumBins) => saveAppSettings({ spectrumBins })}
          />
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-ghost" onClick={addLibraryFolder} disabled={scanning}>
              {scanning ? "Escaneando…" : "Adicionar Pasta de Música"}
            </button>
          </div>
        </div>
        <div className="box" style={{ marginTop: 14 }}>
          <div className="box-label">Pastas da Biblioteca ({appSettings.libraryPaths.length}) · {library.length} faixa(s)</div>
          {appSettings.libraryPaths.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>
              Nenhuma pasta configurada. Adicione uma pasta com músicas do seu PC para a biblioteca ser escaneada de verdade.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {appSettings.libraryPaths.map((p) => (
                <span key={p} className="num" style={{ fontSize: 11.5, color: "var(--text-dim)", wordBreak: "break-all" }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <p style={{ textAlign: "center", fontSize: 10.5, color: "var(--text-faint)" }}>
        SoundCore desktop · configurações salvas no diretório de config do app
      </p>
    </div>
  );
}
