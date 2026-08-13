import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import Toggle from "../components/Toggle";

export default function SettingsPage() {
  const { appSettings, saveAppSettings, devices, selectedId, selectDevice, notify } = useApp();

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <Panel title="Appearance & Language">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-text-dim">Theme</p>
            <div className="flex gap-2">
              {["dark", "light"].map((t) => (
                <button
                  key={t}
                  onClick={() => saveAppSettings({ theme: t })}
                  className={`rounded-lg border px-4 py-2 text-xs font-medium capitalize transition-colors ${
                    appSettings.theme === t
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface-2 text-text-dim hover:text-text"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-text-dim">Language</p>
            <select
              value={appSettings.language}
              onChange={(e) => saveAppSettings({ language: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text"
            >
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="Default Device">
        <p className="mb-3 text-xs text-text-dim">
          Automatically reconnects to this device on startup.
        </p>
        <div className="flex flex-wrap gap-2">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                selectDevice(d.id);
                saveAppSettings({ lastDeviceId: d.id });
                notify(`Default device: ${d.name}`);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                selectedId === d.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface-2 text-text-dim hover:text-text"
              }`}
            >
              {d.name}
            </button>
          ))}
          {devices.length === 0 && (
            <p className="text-xs text-text-dim">No devices found yet.</p>
          )}
        </div>
      </Panel>

      <Panel title="Startup & Behavior">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Toggle
              label="Launch on startup"
              checked={appSettings.launchOnStartup}
              onChange={(v) => saveAppSettings({ launchOnStartup: v })}
            />
            <Toggle
              label="Minimize to tray"
              checked={appSettings.minimizeToTray}
              onChange={(v) => saveAppSettings({ minimizeToTray: v })}
            />
          </div>
          <div className="space-y-3">
            <Toggle
              label="Notifications"
              checked={appSettings.notifications}
              onChange={(v) => saveAppSettings({ notifications: v })}
            />
            <Toggle
              label="Check for updates"
              checked={appSettings.checkUpdates}
              onChange={(v) => saveAppSettings({ checkUpdates: v })}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Audio">
        <div className="grid gap-4 sm:grid-cols-2">
          <Slider
            label="Spectrum bins"
            value={appSettings.spectrumBins}
            min={16}
            max={128}
            step={8}
            onChange={(spectrumBins) => saveAppSettings({ spectrumBins })}
          />
          <div className="flex items-end">
            <button
              onClick={() => notify("Library paths editor coming soon.")}
              className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs text-text-dim hover:text-text"
            >
              MANAGE LIBRARY PATHS ({appSettings.libraryPaths.length})
            </button>
          </div>
        </div>
      </Panel>

      <p className="text-center text-[10px] text-text-dim/60">
        SoundCore desktop · settings stored in app config dir
      </p>
    </div>
  );
}