import { useState } from "react";
import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import Toggle from "../components/Toggle";

const CATEGORY_COLORS: Record<string, string> = {
  gaming: "text-accent",
  music: "text-blue-400",
  movie: "text-amber-400",
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
    <div className="flex h-full flex-col gap-4">
      <p className="max-w-lg text-xs leading-relaxed text-text-dim">
        Save DSP snapshots per use case. Activate a profile to push its settings to the Audio Lab —
        or let App Profiles switch them automatically by running application.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => {
          const isActive = active === p.id;
          const isEditing = editing === p.id;
          return (
            <Panel key={p.id} title={p.name} className="relative">
              <span
                className={`absolute right-4 top-3 text-[10px] font-semibold uppercase tracking-widest ${
                  CATEGORY_COLORS[p.category] ?? "text-text-dim"
                }`}
              >
                {p.category}
              </span>

              {isEditing ? (
                <div className="space-y-3">
                  <Slider
                    label="Bass"
                    value={p.bass}
                    min={-6}
                    max={6}
                    unit="dB"
                    onChange={() => {
                      /* local edits would persist to backend */
                    }}
                  />
                  <Slider
                    label="Mids"
                    value={p.mids}
                    min={-6}
                    max={6}
                    unit="dB"
                    onChange={() => {}}
                  />
                  <Slider
                    label="Treble"
                    value={p.treble}
                    min={-6}
                    max={6}
                    unit="dB"
                    onChange={() => {}}
                  />
                  <div className="space-y-2">
                    <Toggle label="Spatial" checked={p.spatial} onChange={() => {}} />
                    <Toggle label="Loudness" checked={p.loudness} onChange={() => {}} />
                  </div>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-lg border border-border px-3 py-1.5 text-[10px] tracking-widest text-text-dim"
                  >
                    DONE
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-text-dim">
                  <p>
                    Bass <span className="font-mono text-text">{p.bass} dB</span>
                  </p>
                  <p>
                    Mids <span className="font-mono text-text">{p.mids} dB</span>
                  </p>
                  <p>
                    Treble <span className="font-mono text-text">{p.treble} dB</span>
                  </p>
                  <p className="flex items-center gap-2">
                    Spatial
                    <span className={p.spatial ? "text-accent" : "text-text-dim/50"}>
                      {p.spatial ? "ON" : "OFF"}
                    </span>
                    <span className="mx-1">·</span>
                    Loudness
                    <span className={p.loudness ? "text-accent" : "text-text-dim/50"}>
                      {p.loudness ? "ON" : "OFF"}
                    </span>
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => apply(p.id)}
                      className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest transition-colors ${
                        isActive
                          ? "border-accent bg-accent text-black"
                          : "border-accent text-accent hover:bg-accent hover:text-black"
                      }`}
                    >
                      {isActive ? "ACTIVE" : "APPLY"}
                    </button>
                    <button
                      onClick={() => setEditing(p.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-[10px] tracking-widest text-text-dim hover:text-text"
                    >
                      EDIT
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