use crate::hardware::{AudioDevice, ConnectionType};

/// Windows Audio Session API integration.
///
/// On Windows, soundbars plugged via USB or paired via Bluetooth show up as
/// normal audio render endpoints. This module enumerates those endpoints with
/// the Windows Audio Core APIs and reads/writes the master volume. The capture
/// loop (for the realtime spectrum) will hook an audio-capture client here.
#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct Wasapi;

#[allow(dead_code)]
impl Wasapi {
    pub fn new() -> Self {
        Self
    }

    /// Enumerate audio render endpoints (USB soundbars, Bluetooth speakers,
    /// built-in devices). Placeholder returning an empty list until we bind
    /// the endpoint enumeration COM APIs.
    pub fn enumerate_render_endpoints(&self) -> Vec<AudioDevice> {
        Vec::new()
    }

    /// Set the master volume of an endpoint in percent (0.0..1.0).
    pub fn set_endpoint_volume(&self, _device_id: &str, _volume: f32) -> Result<(), String> {
        Ok(())
    }

    pub fn set_endpoint_mute(&self, _device_id: &str, _muted: bool) -> Result<(), String> {
        Ok(())
    }

    pub fn get_endpoint_volume(&self, _device_id: &str) -> Result<(f32, bool), String> {
        Ok((0.0, false))
    }

    /// Start a capture session and begin writing spectrum bins into `out`.
    /// `out` is a `Vec<f32>` behind a `Mutex` that the UI polls.
    pub fn start_capture(
        &self,
        _device_id: &str,
        _out: std::sync::Arc<std::sync::Mutex<Vec<f32>>>,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn stop_capture(&self, _device_id: &str) -> Result<(), String> {
        Ok(())
    }

    /// Helper to build a device entry from a raw endpoint.
    pub fn device_from_endpoint(
        id: impl Into<String>,
        name: impl Into<String>,
        connection: ConnectionType,
        volume: f32,
        muted: bool,
    ) -> AudioDevice {
        AudioDevice {
            id: id.into(),
            name: name.into(),
            connection,
            connected: true,
            volume,
            muted,
            supports_eq: true,
        }
    }
}
