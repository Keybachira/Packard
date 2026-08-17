import { useEffect } from "react";
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
import "./styles/premium.css";
import "./styles/glass.css";
import { AppProvider, useApp } from "./context/AppStore";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import PlayerBar from "./components/PlayerBar";
import Onboarding from "./components/Onboarding";
import ToastStack from "./components/ToastStack";
import MiniPlayerWindow from "./components/MiniPlayerWindow";
import TitleBar from "./components/TitleBar";
import HomePage from "./pages/HomePage";
import PlayerPage from "./pages/PlayerPage";
import LibraryPage from "./pages/LibraryPage";
import AudioLabPage from "./pages/AudioLabPage";
import CalibrationPage from "./pages/CalibrationPage";
import DevicesPage from "./pages/DevicesPage";
import AnalyzerPage from "./pages/AnalyzerPage";
import ProfilesPage from "./pages/ProfilesPage";
import AppProfilesPage from "./pages/AppProfilesPage";
import RemotePage from "./pages/RemotePage";
import SettingsPage from "./pages/SettingsPage";

function ThemeApplier() {
  const { appSettings } = useApp();
  // Mutating <html> directly in the render body (instead of an effect) ran
  // on every re-render of the app — including the playback/queue poll every
  // 800ms — forcing a full-page style recalculation each time even when
  // neither the theme nor the accent color had actually changed. That's what
  // read as a faint, constant flicker across every card/panel in the app.
  // Scoping it to an effect keyed on the two values that matter means it
  // only touches the DOM when the theme or accent color really changes.
  useEffect(() => {
    const light = appSettings.theme === "light";
    document.documentElement.className = light ? "light" : "";
    document.documentElement.style.setProperty(
      "--accentColor",
      appSettings.accent || "#22c55e",
    );
  }, [appSettings.theme, appSettings.accent]);
  return null;
}

function Shell() {
  const { section, settingsReady, appSettings, miniMode } = useApp();

  if (miniMode) {
    return (
      <div className="app app-mini">
        <ThemeApplier />
        <MiniPlayerWindow />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app">
        <div id="main-view">
          <div id="sub-view-1">
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
              {section === "remote" && <RemotePage />}
              {section === "settings" && <SettingsPage />}
            </div>
          </div>
          <PlayerBar />
        </div>

        {settingsReady && !appSettings.onboarded && <Onboarding />}

        <ToastStack />
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
