import { useApp } from "../context/AppStore";
import { IconBell, IconMoon, IconSearch, IconSun } from "./icons";

export default function Topbar() {
  const { appSettings, saveAppSettings } = useApp();
  const light = appSettings.theme === "light";

  return (
    <div className="topbar">
      <div className="search">
        <IconSearch size={16} />
        <input placeholder="Buscar músicas, artistas, álbuns..." />
      </div>

      <button
        className="icon-btn"
        title="Alternar tema"
        onClick={() => saveAppSettings({ theme: light ? "dark" : "light" })}
        style={{ display: "flex" }}
      >
        {light ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>

      <button className="icon-btn" style={{ display: "flex" }}>
        <IconBell size={18} />
        <span className="dot-badge" />
      </button>

      <div className="user-chip">
        <img
          src="https://i.pravatar.cc/64"
          alt="Usuário"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div>
          <div className="name">Aquiles</div>
          <div className="plan">Premium</div>
        </div>
      </div>
    </div>
  );
}
