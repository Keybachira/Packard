use crate::hardware::AudioDevice;

/// Bluetooth (A2DP/AVRCP) communication with the soundbar.
///
/// Windows exposes Bluetooth audio devices through the audio endpoint APIs
/// (WASAPI), so device discovery happens in the `windows` module. AVRCP
/// metadata/transport control would be added here once in-band control is
/// needed. Stubs below keep the app compiling.
#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct BluetoothBackend;

#[allow(dead_code)]
impl BluetoothBackend {
    pub fn new() -> Self {
        Self
    }

    pub fn enumerate(&self) -> Vec<AudioDevice> {
        Vec::new()
    }

    pub fn pair(&self, _device_id: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn connect(&self, _device_id: &str) -> Result<(), String> {
        Ok(())
    }
}
