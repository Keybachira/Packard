use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

/// User preferences persisted to `app_config_dir/settings.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub launch_on_startup: bool,
    pub minimize_to_tray: bool,
    pub notifications: bool,
    pub check_updates: bool,
    pub last_device_id: Option<String>,
    pub library_paths: Vec<String>,
    pub spectrum_bins: u32,
    pub profile_auto_switch: bool,
    pub onboarded: bool,
    pub accent: String,
    pub username: String,
    /// Local profile photo, stored as a data: URL (no cloud upload involved).
    pub avatar: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            language: "en".into(),
            launch_on_startup: false,
            minimize_to_tray: true,
            notifications: true,
            check_updates: true,
            last_device_id: None,
            library_paths: Vec::new(),
            spectrum_bins: 48,
            profile_auto_switch: false,
            onboarded: false,
            accent: "#22c55e".into(),
            username: String::new(),
            avatar: String::new(),
        }
    }
}

impl AppSettings {
    fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("failed to resolve config dir: {e}"))?;
        std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create config dir: {e}"))?;
        Ok(dir.join("settings.json"))
    }

    pub fn load(app: &tauri::AppHandle) -> Self {
        let path = match Self::path(app) {
            Ok(p) => p,
            Err(_) => return Self::default(),
        };
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, app: &tauri::AppHandle) -> Result<(), String> {
        let path = Self::path(app)?;
        let raw = serde_json::to_string_pretty(self).map_err(|e| format!("serialize: {e}"))?;
        std::fs::write(path, raw).map_err(|e| format!("write settings: {e}"))
    }
}