//! USB HID transport over `hidapi`.
//!
//! Real enumeration/open/read/write of HID devices. This is the physical
//! transport used by `UsbBackend`; the command bytes it carries are produced
//! by the codec in `super::protocol`. Report-id-less devices are handled by
//! prefixing/stripping a `0x00` byte, the standard pattern for output
//! reports / input reads on such devices.

use hidapi::{HidApi, HidError};
pub use hidapi::HidDevice;

/// Copy of the fields we care about from `hidapi::HidDeviceInfo`, owned.
#[derive(Debug, Clone)]
pub struct HidDeviceInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub usage_page: u16,
    pub usage: u16,
    pub interface_number: i32,
    pub product_string: Option<String>,
    pub manufacturer_string: Option<String>,
    pub serial_number: Option<String>,
    pub path: String,
}

impl HidDeviceInfo {
    pub fn display_name(&self) -> String {
        self.product_string
            .clone()
            .or_else(|| self.manufacturer_string.clone())
            .unwrap_or_else(|| format!("HID {:04X}:{:04X}", self.vendor_id, self.product_id))
    }
}

/// Thin wrapper around a `HidApi` instance.
pub struct HidTransport {
    api: HidApi,
}

impl HidTransport {
    pub fn new() -> Result<Self, String> {
        HidApi::new()
            .map(|api| Self { api })
            .map_err(|e| format!("hidapi: {e}"))
    }

    /// Enumerate every HID device attached to the machine.
    pub fn enumerate(&self) -> Result<Vec<HidDeviceInfo>, String> {
        let mut out = Vec::new();
        for info in self.api.device_list() {
            out.push(HidDeviceInfo {
                vendor_id: info.vendor_id(),
                product_id: info.product_id(),
                usage_page: info.usage_page(),
                usage: info.usage(),
                interface_number: info.interface_number(),
                product_string: info.product_string().map(ToOwned::to_owned),
                manufacturer_string: info.manufacturer_string().map(ToOwned::to_owned),
                serial_number: info.serial_number().map(ToOwned::to_owned),
                path: info.path().to_string_lossy().into_owned(),
            });
        }
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    /// Enumerate devices matching a specific vendor/product pair. Useful for the
    /// real vendor codec once the soundbar's VID/PID is known.
    #[allow(dead_code)]
    pub fn find(&self, vendor_id: u16, product_id: u16) -> Result<Vec<HidDeviceInfo>, String> {
        Ok(self
            .enumerate()?
            .into_iter()
            .filter(|d| d.vendor_id == vendor_id && d.product_id == product_id)
            .collect())
    }

    /// Open a device by its enumeration path.
    pub fn open(&self, info: &HidDeviceInfo) -> Result<HidDevice, String> {
        use std::ffi::CString;
        let cpath = CString::new(info.path.as_str())
            .map_err(|e| format!("caminho HID inválido: {e}"))?;
        self.api
            .open_path(&cpath)
            .map_err(|e| format!("abrir {}: {e}", info.display_name()))
    }

    /// Send a report. A leading `0x00` is prepended so report-id-less devices
    /// treat the payload as a data-only output report.
    pub fn write_report(&self, device: &HidDevice, report: &[u8]) -> Result<(), String> {
        let mut buf = Vec::with_capacity(report.len() + 1);
        buf.push(0u8);
        buf.extend_from_slice(report);
        device.write(&buf).map(|_| ()).map_err(|e| e.to_string())
    }

    /// Read a single input report (with `0x00` stripped), waiting up to
    /// `timeout_ms`. Returns `Err` on timeout.
    pub fn read_status(&self, device: &HidDevice, timeout_ms: u32) -> Result<Vec<u8>, String> {
        let mut buf = [0u8; 65];
        let n = device
            .read_timeout(&mut buf, timeout_ms as i32)
            .map_err(|e| match e {
                HidError::HidApiError { message } if message == "hid_read_timeout" => {
                    format!("sem resposta do dispositivo dentro de {timeout_ms} ms")
                }
                other => other.to_string(),
            })?;
        Ok(buf[1..n].to_vec())
    }
}

#[cfg(windows)]
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hid_api_constructs_on_windows() {
        let transport = HidTransport::new().expect("hidapi available");
        // Enumerating with zero devices attached must still succeed.
        let _ = transport.enumerate().expect("enumeration ok");
    }
}