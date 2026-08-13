use crate::hardware::AudioDevice;

/// USB/HID communication with the soundbar.
///
/// NOTE: the protocol is vendor-specific. This module is where you discover
/// the device (VID/PID), open the HID/serial endpoint and encode the command
/// bytes that the soundbar's DSP understands. The stubs below return
/// gracefully so the app compiles and runs before the protocol is known.
#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct UsbBackend;

#[allow(dead_code)]
impl UsbBackend {
    pub fn new() -> Self {
        Self
    }

    /// Enumerate USB sound devices. Replace with `hidapi`/`serialport`/WMI
    /// enumeration once the vendor's VID/PID is known.
    pub fn enumerate(&self) -> Vec<AudioDevice> {
        Vec::new()
    }

    /// Send a raw command packet to a device. Placeholder until the protocol
    /// is reverse-engineered or documented by the vendor.
    pub fn send_command(&self, _device_id: &str, _command: &[u8]) -> Result<(), String> {
        Ok(())
    }

    /// Read a status packet (volume, eq, mute state) from the device.
    pub fn read_status(&self, _device_id: &str) -> Result<Vec<u8>, String> {
        Ok(Vec::new())
    }
}
