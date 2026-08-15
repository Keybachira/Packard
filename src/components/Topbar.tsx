import { useApp } from "../context/AppStore";
import { IconMinimize2, IconMoon, IconSearch, IconSun } from "./icons";
import NotificationCenter from "./NotificationCenter";

export default function Topbar() {
  const { appSettings, saveAppSettings, setSection, section, miniMode, toggleMiniMode } =
    useApp();
  const light = appSettings.theme === "light";
  const initial = (appSettings.username || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="topbar">
      <div className="search">
        <IconSearch size={16} />
        <input placeholder="Buscar músicas, artistas, álbuns..." />
      </div>

      <button
        className="icon-btn"
        title="Modo mini (canto da tela)"
        onClick={() => toggleMiniMode()}
        style={{ display: "flex" }}
        disabled={miniMode}
      >
        <IconMinimize2 size={17} />
      </button>

      <button
        className="icon-btn"
        title="Alternar tema"
        onClick={() => saveAppSettings({ theme: light ? "dark" : "light" })}
        style={{ display: "flex" }}
      >
        {light ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>

      <NotificationCenter />

      <button
        type="button"
        className={`user-chip ${section === "settings" ? "active" : ""}`}
        onClick={() => setSection("settings")}
        title="Editar perfil"
      >
        {appSettings.avatar ? (
          <img src={appSettings.avatar} alt={appSettings.username || "Perfil"} />
        ) : (
          <span className="user-chip-fallback">{initial}</span>
        )}
        <div>
          <div className="name">{appSettings.username || "Convidado"}</div>
          <div className="plan">Local</div>
        </div>
      </button>
    </div>
  );
}
