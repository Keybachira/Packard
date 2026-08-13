import { useApp, type SectionId } from "../context/AppStore";

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "player", label: "Player", icon: "▶" },
  { id: "library", label: "Library", icon: "♫" },
  { id: "audioLab", label: "Audio Lab", icon: "≋" },
  { id: "calibration", label: "Calibration", icon: "◎" },
  { id: "devices", label: "Devices", icon: "▣" },
  { id: "analyzer", label: "Analyzer", icon: "▂" },
  { id: "profiles", label: "Profiles", icon: "◈" },
  { id: "appProfiles", label: "App Profiles", icon: "⌬" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar() {
  const { section, setSection, selected } = useApp();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-2/40">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-lg">◈</span>
        <span className="text-sm font-bold tracking-tight text-text">
          SOUND<span className="text-accent">CORE</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-dim hover:bg-surface-2 hover:text-text"
              }`}
            >
              <span className={`w-4 text-center ${active ? "text-accent" : "text-text-dim/70"}`}>
                {s.icon}
              </span>
              {s.label}
              {s.id === "devices" && selected?.connected && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" title="Connected" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        {selected ? (
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${selected.connected ? "bg-accent" : "bg-text-dim"}`}
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-text">{selected.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-text-dim">
                {selected.connection}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-dim">No device</p>
        )}
      </div>
    </aside>
  );
}