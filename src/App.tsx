import "@fontsource/roboto/100.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./App.css";
import "./styles/prototype.css";
import "./styles/flb.css";
import { AppProvider, useApp } from "./context/AppStore";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import PlayerBar from "./components/PlayerBar";
import HomePage from "./pages/HomePage";
import PlayerPage from "./pages/PlayerPage";
import LibraryPage from "./pages/LibraryPage";
import AudioLabPage from "./pages/AudioLabPage";
import CalibrationPage from "./pages/CalibrationPage";
import DevicesPage from "./pages/DevicesPage";
import AnalyzerPage from "./pages/AnalyzerPage";
import ProfilesPage from "./pages/ProfilesPage";
import AppProfilesPage from "./pages/AppProfilesPage";
import SettingsPage from "./pages/SettingsPage";

function ThemeApplier() {
  const { appSettings } = useApp();
  const light = appSettings.theme === "light";
  document.documentElement.className = light ? "light" : "";
  return null;
}

function Shell() {
  const { section, status } = useApp();

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <ThemeApplier />
        {section === "home" && <HomePage />}
        {section === "player" && <PlayerPage />}
        {section === "library" && <LibraryPage />}
        {section === "audioLab" && <AudioLabPage />}
        {section === "calibration" && <CalibrationPage />}
        {section === "devices" && <DevicesPage />}
        {section === "analyzer" && <AnalyzerPage />}
        {section === "profiles" && <ProfilesPage />}
        {section === "appProfiles" && <AppProfilesPage />}
        {section === "settings" && <SettingsPage />}

        <PlayerBar />

        {status && (
          <div
            className="status-toast"
            style={{
              position: "fixed",
              bottom: 96,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--panel)",
              border: "1px solid var(--border-soft)",
              color: "var(--text)",
              padding: "10px 18px",
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 700,
              zIndex: 100,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            {status}
          </div>
        )}
      </div>
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
