use serde::{Deserialize, Serialize};

/// A named profile (Gaming / Music / Movie ...) with the DSP settings it
/// applies when activated.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub category: String,
    pub bass: f32,
    pub mids: f32,
    pub treble: f32,
    pub spatial: bool,
    pub loudness: bool,
    pub subwoofer_gain: f32,
}

impl Profile {
    pub fn seed() -> Vec<Self> {
        vec![
            Profile {
                id: "profile-fps".into(),
                name: "FPS".into(),
                category: "gaming".into(),
                bass: 2.0,
                mids: 1.0,
                treble: 4.0,
                spatial: true,
                loudness: false,
                subwoofer_gain: 3.0,
            },
            Profile {
                id: "profile-afrohouse".into(),
                name: "Afro House".into(),
                category: "music".into(),
                bass: 3.0,
                mids: 1.0,
                treble: 2.0,
                spatial: false,
                loudness: true,
                subwoofer_gain: 4.0,
            },
            Profile {
                id: "profile-cinema".into(),
                name: "Cinema".into(),
                category: "movie".into(),
                bass: 5.0,
                mids: -1.0,
                treble: 2.0,
                spatial: true,
                loudness: false,
                subwoofer_gain: 6.0,
            },
        ]
    }
}

/// Maps a running executable (e.g. `Spotify.exe`) to a profile id.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppProfileBinding {
    pub app: String,
    pub profile_id: String,
    pub enabled: bool,
}

impl AppProfileBinding {
    pub fn seed() -> Vec<Self> {
        vec![
            AppProfileBinding {
                app: "Spotify.exe".into(),
                profile_id: "profile-afrohouse".into(),
                enabled: true,
            },
            AppProfileBinding {
                app: "VALORANT.exe".into(),
                profile_id: "profile-fps".into(),
                enabled: true,
            },
            AppProfileBinding {
                app: "VLC.exe".into(),
                profile_id: "profile-cinema".into(),
                enabled: true,
            },
            AppProfileBinding {
                app: "chrome.exe".into(),
                profile_id: "profile-afrohouse".into(),
                enabled: false,
            },
        ]
    }
}

/// A completed room calibration result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomProfile {
    pub name: String,
    pub bass_resonance_hz: f32,
    pub correction_db: f32,
    pub stereo_imbalance_db: f32,
    pub curve: Vec<f32>,
}
