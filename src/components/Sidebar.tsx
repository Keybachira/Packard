import { type ReactNode } from "react";
import { useApp, type SectionId } from "../context/AppStore";
import MiniPlayer from "./MiniPlayer";
import {
  IconHeadphones,
  IconHome,
  IconLibrary,
  IconMic,
  IconPulse,
  IconSettings,
  IconSliders,
  IconSpeaker,
} from "./icons";

const SECTIONS: { id: SectionId; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Página Inicial", icon: <IconHome size={18} /> },
  { id: "player", label: "Reprodutor", icon: <IconHeadphones size={18} /> },
  { id: "library", label: "Biblioteca", icon: <IconLibrary size={18} /> },
  { id: "audioLab", label: "Audio Lab", icon: <IconSliders size={18} /> },
  { id: "calibration", label: "Calibração", icon: <IconMic size={18} /> },
  { id: "devices", label: "Dispositivos", icon: <IconSpeaker size={18} /> },
  { id: "analyzer", label: "Analisador", icon: <IconPulse size={18} /> },
  { id: "profiles", label: "Perfis", icon: <IconSliders size={18} /> },
  { id: "appProfiles", label: "App Profiles", icon: <IconLibrary size={18} /> },
  { id: "settings", label: "Configurações", icon: <IconSettings size={18} /> },
];

export default function Sidebar() {
  const { section, setSection } = useApp();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-bars">
          {[10, 18, 14, 22, 12].map((h, i) => (
            <span key={i} style={{ height: h }} />
          ))}
        </div>
        <div className="brand-text">
          <div>
            <span className="l1">SOUND</span>
            <span className="l2">CORE</span>
          </div>
          <div className="tag">AUDIO ENGINE</div>
        </div>
      </div>

      <nav className="nav">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <div
              key={s.id}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              {s.icon}
              {s.label}
            </div>
          );
        })}
      </nav>

      <div className="nav-spacer" />
      <MiniPlayer />
    </aside>
  );
}
