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
    <div className="flex h-full flex-col gap-4">
      <Panel title="Auto Profile Switching">
        <p className="mb-4 max-w-lg text-xs leading-relaxed text-text-dim">
          SoundCore watches the foreground window. When a bound executable has focus, its profile is
          applied automatically — Spotify for music, VALORANT for FPS, VLC for cinema.
        </p>

        <div className="mb-4">
          <Toggle
            label="Enable automatic profile switching"
            checked={appSettings.profileAutoSwitch}
            onChange={(v) => saveAppSettings({ profileAutoSwitch: v })}
          />
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-xs text-text">Foreground app:</span>
          <span className="font-mono text-xs text-accent">{foregroundApp ?? "unknown.exe"}</span>
          <span className="ml-auto text-[10px] text-text-dim">
            →{" "}
            {PROFILE_NAMES[
              bindings.find((b) => b.app.toLowerCase() === (foregroundApp ?? "").toLowerCase())
                ?.profileId ?? ""
            ] ?? "No binding"}
          </span>
        </div>
      </Panel>

      <Panel title="Bindings">
        <div className="space-y-2">
          {bindings.map((b) => (
            <div
              key={b.app}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                b.enabled ? "border-border bg-surface-2/50" : "border-border/50 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-text">{b.app}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-dim">
                  → {PROFILE_NAMES[b.profileId] ?? b.profileId}
                </span>
              </div>
              <span className="text-[10px] text-text-dim">
                {b.enabled ? "active" : "disabled"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-text-dim">
          Profiles available: {profiles.map((p) => p.name).join(", ")}
        </p>
      </Panel>
    </div>
  );
}