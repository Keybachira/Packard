import "./App.css";
import { AppProvider, useApp } from "./context/AppStore";
import Sidebar from "./components/Sidebar";
import PlayerPage from "./pages/PlayerPage";
import LibraryPage from "./pages/LibraryPage";
import AudioLabPage from "./pages/AudioLabPage";
import CalibrationPage from "./pages/CalibrationPage";
import DevicesPage from "./pages/DevicesPage";
import AnalyzerPage from "./pages/AnalyzerPage";
import ProfilesPage from "./pages/ProfilesPage";
import AppProfilesPage from "./pages/AppProfilesPage";
import SettingsPage from "./pages/SettingsPage";

function Shell() {
  const { section, status } = useApp();

  return (
    <div className="flex h-full bg-bg text-text">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 overflow-hidden p-6">
          <div className="flex-1 overflow-hidden">
            {section === "player" && <PlayerPage />}
            {section === "library" && <LibraryPage />}
            {section === "audioLab" && <AudioLabPage />}
            {section === "calibration" && <CalibrationPage />}
            {section === "devices" && <DevicesPage />}
            {section === "analyzer" && <AnalyzerPage />}
            {section === "profiles" && <ProfilesPage />}
            {section === "appProfiles" && <AppProfilesPage />}
            {section === "settings" && <SettingsPage />}
          </div>
        </div>

        {status && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-xs text-accent shadow-lg">
            {status}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}