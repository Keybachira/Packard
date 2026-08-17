pub mod bluetooth;
pub mod devices;
pub mod usb;

use serde::{Deserialize, Serialize};

/// How a device is physically connected to the machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    Usb,
    Bluetooth,
    Hdmi,
    Dac,
    Headphones,
    Microphone,
    AudioInterface,
    None,
}

impl std::fmt::Display for ConnectionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConnectionType::Usb => write!(f, "usb"),
            ConnectionType::Bluetooth => write!(f, "bluetooth"),
            ConnectionType::Hdmi => write!(f, "hdmi"),
            ConnectionType::Dac => write!(f, "dac"),
            ConnectionType::Headphones => write!(f, "headphones"),
            ConnectionType::Microphone => write!(f, "microphone"),
            ConnectionType::AudioInterface => write!(f, "audio_interface"),
            ConnectionType::None => write!(f, "none"),
        }
    }
}

/// A sound device discovered by the hardware layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub connection: ConnectionType,
    pub connected: bool,
    pub volume: f32,
    pub muted: bool,
    pub supports_eq: bool,
    /// True when this is the OS's current default endpoint for its data
    /// flow (default playback device, or default recording device).
    pub is_default: bool,
}

impl AudioDevice {
    pub fn offline(id: impl Into<String>, name: impl Into<String>, connection: ConnectionType) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            connection,
            connected: false,
            volume: 0.0,
            muted: false,
            supports_eq: false,
            is_default: false,
        }
    }
}

/// Per-device DSP/settings state that mirrors what the UI holds.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSettings {
    pub volume: f32,
    pub muted: bool,
    pub eq: Vec<f32>,
    pub preset: String,
    pub subwoofer: SubwooferState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubwooferState {
    pub gain: f32,
    pub frequency: f32,
    pub phase: u8,
    pub enabled: bool,
}

impl Default for DeviceSettings {
    fn default() -> Self {
        Self {
            volume: 72.0,
            muted: false,
            eq: vec![0.0; 10],
            preset: "FLAT".into(),
            subwoofer: SubwooferState {
                gain: 0.0,
                frequency: 80.0,
                phase: 0,
                enabled: true,
            },
        }
    }
}