import {
  IconAlbum,
  IconClock,
  IconFolder,
  IconHome,
  IconList,
  IconNote,
  IconUser,
} from "../icons";

export type MusicTab =
  | "home"
  | "tracks"
  | "recents"
  | "playlists"
  | "artists"
  | "albums"
  | "folders";

interface Props {
  tab: MusicTab;
  onChange: (t: MusicTab) => void;
  counts: Partial<Record<MusicTab, number>>;
}

const TABS: { key: MusicTab; label: string; icon: typeof IconHome }[] = [
  { key: "home", label: "Início", icon: IconHome },
  { key: "tracks", label: "Faixas", icon: IconNote },
  { key: "recents", label: "Recentes", icon: IconClock },
  { key: "playlists", label: "Playlists", icon: IconList },
  { key: "artists", label: "Artistas", icon: IconUser },
  { key: "albums", label: "Álbuns", icon: IconAlbum },
  { key: "folders", label: "Pastas", icon: IconFolder },
];

export default function TabSwitcher({ tab, onChange, counts }: Props) {
  return (
    <nav className="tab-switcher">
      {TABS.map(({ key, label, icon: Icon }) => {
        const count = counts[key];
        return (
          <button
            key={key}
            className={`tab-btn${tab === key ? " active" : ""}`}
            onClick={() => onChange(key)}
          >
            <Icon size={15} />
            {label}
            {typeof count === "number" && (
              <span style={{ opacity: 0.75, fontWeight: 700, fontSize: 11 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}