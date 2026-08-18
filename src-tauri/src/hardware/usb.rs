//! USB/HID backend: real device discovery + command transport.
//!
//! [`UsbBackend`] combines the physical HID transport (`super::hid`) with a
//! pluggable wire codec (`super::protocol`). Until the vendor's VID/PID and
//! protocol are known it ships with [`SimulatedCodec`]; swap in a real
//! [`VendorCodec`] implementation without touching anything else here.

use crate::hardware::hid::{HidDevice, HidDeviceInfo, HidTransport};
use crate::hardware::protocol::{Command, DspStatus, SimulatedCodec, VendorCodec};
use serde::Serialize;

/// A USB device discovered by the HID transport, ready to serialize to the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareDevice {
    pub id: String,
    pub name: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub usage_page: u16,
    pub usage: u16,
    pub interface_number: i32,
    pub product_string: Option<String>,
    pub manufacturer_string: Option<String>,
    pub serial_number: Option<String>,
}

impl From<HidDeviceInfo> for HardwareDevice {
    fn from(info: HidDeviceInfo) -> Self {
        Self {
            id: info.path.clone(),
            name: info.display_name(),
            vendor_id: info.vendor_id,
            product_id: info.product_id,
            usage_page: info.usage_page,
            usage: info.usage,
            interface_number: info.interface_number,
            product_string: info.product_string,
            manufacturer_string: info.manufacturer_string,
            serial_number: info.serial_number,
        }
    }
}

/// Communication with the physical soundbar over USB/HID.
pub struct UsbBackend {
    pub codec: Box<dyn VendorCodec>,
    transport: HidTransport,
}

impl UsbBackend {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            codec: Box::new(SimulatedCodec),
            transport: HidTransport::new()?,
        })
    }

    /// Build a backend with a concrete vendor codec (the drop-in point once
    /// the real protocol is known).
    #[allow(dead_code)]
    pub fn with_codec(codec: Box<dyn VendorCodec>) -> Result<Self, String> {
        Ok(Self {
            codec,
            transport: HidTransport::new()?,
        })
    }

    /// List every USB device exposed over HID.
    pub fn enumerate_devices(&self) -> Result<Vec<HardwareDevice>, String> {
        Ok(self
            .transport
            .enumerate()?
            .into_iter()
            .map(HardwareDevice::from)
            .collect())
    }

    /// Devices matching the codec's declared VID/PID (the soundbar itself),
    /// falling back to all HID devices when the codec has no known vendor.
    pub fn enumerate_targets(&self) -> Result<Vec<HardwareDevice>, String> {
        let all = self.enumerate_devices()?;
        match self.codec.vendor_id() {
            Some((vid, pid)) => Ok(all
                .into_iter()
                .filter(|d| d.vendor_id == vid && d.product_id == pid)
                .collect()),
            None => Ok(all),
        }
    }

    /// Encode a command and write it to the device.
    pub fn send_command(&self, device_id: &str, cmd: &Command) -> Result<(), String> {
        let device = self.open(device_id)?;
        let report = self.codec.encode(cmd);
        self.transport.write_report(&device, &report)
    }

    /// Ask the device for its current DSP state.
    pub fn read_status(&self, device_id: &str, timeout_ms: u32) -> Result<DspStatus, String> {
        let device = self.open(device_id)?;
        let report = self.transport.read_status(&device, timeout_ms)?;
        self.codec
            .decode_status(&report)
            .ok_or_else(|| "resposta de estado inválida ou inesperada".to_string())
    }

    fn open(&self, device_id: &str) -> Result<HidDevice, String> {
        let info = self
            .transport
            .enumerate()?
            .into_iter()
            .find(|d| d.path == device_id)
            .ok_or_else(|| format!("dispositivo HID '{device_id}' não encontrado"))?;
        self.transport.open(&info)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hardware::protocol::{Command, SimulatedDevice, VendorCodec};

    #[test]
    fn default_codec_is_simulated_until_vendor_known() {
        let backend = UsbBackend::new().expect("backend");
        assert_eq!(backend.codec.vendor_id(), None);
    }

    #[test]
    fn codec_roundtrip_drives_a_simulated_device() {
        // Exercise the full path the backend will take once hardware exists:
        // command -> codec.encode -> device.handle -> status -> decode_status.
        let codec = SimulatedCodec;
        let mut device = SimulatedDevice::new();
        device.handle(&codec.encode(&Command::Volume(30)));
        let reply = device.handle(&codec.encode(&Command::Status)).unwrap();
        let status = codec.decode_status(&reply).unwrap();
        assert_eq!(status.volume, 30);
    }
}