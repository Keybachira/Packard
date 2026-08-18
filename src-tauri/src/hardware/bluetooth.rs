use windows::Win32::Devices::Bluetooth::{
    BluetoothFindDeviceClose, BluetoothFindFirstDevice, BluetoothFindNextDevice,
    BLUETOOTH_DEVICE_INFO, BLUETOOTH_DEVICE_SEARCH_PARAMS,
};

use crate::hardware::{AudioDevice, ConnectionType};

/// Bluetooth (A2DP/AVRCP) communication with the soundbar.
///
/// Windows exposes Bluetooth audio devices through the audio endpoint APIs
/// (WASAPI), so device discovery happens in the `windows` module. This
/// backend enumerates the classic (BR/EDR) Bluetooth radio via the
/// Bluetooth Find* APIs to surface paired devices that aren't currently
/// active as WASAPI endpoints — the UI shows both and merges them. AVRCP
/// metadata/transport control would be added here once in-band control is
/// needed.
#[derive(Debug, Default)]
pub struct BluetoothBackend;

impl BluetoothBackend {
    pub fn new() -> Self {
        Self
    }

    /// Enumerate remembered/authenticated Bluetooth devices. Non-blocking:
    /// `fIssueInquiry` stays off, so only devices the OS already knows
    /// (remembered, authenticated or currently connected) are returned —
    /// no page scan, no pairing prompts.
    pub fn enumerate(&self) -> Vec<AudioDevice> {
        let mut search = BLUETOOTH_DEVICE_SEARCH_PARAMS::default();
        search.dwSize = std::mem::size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32;
        search.fReturnAuthenticated = true.into();
        search.fReturnRemembered = true.into();
        search.fReturnUnknown = true.into();
        search.fReturnConnected = true.into();
        search.fIssueInquiry = false.into();

        let mut info = BLUETOOTH_DEVICE_INFO::default();
        info.dwSize = std::mem::size_of::<BLUETOOTH_DEVICE_INFO>() as u32;

        // The first device is written into `info` by the call itself.
        let Ok(find) = (unsafe { BluetoothFindFirstDevice(&search, &mut info) }) else {
            return Vec::new();
        };

        let mut devices = Vec::new();
        loop {
            let name = bt_name(&info.szName);
            if is_audio_class(info.ulClassofDevice) && !name.is_empty() {
                let address = unsafe { info.Address.Anonymous.ullLong };
                devices.push(AudioDevice {
                    id: format!("bt-{address:012X}"),
                    name,
                    connection: ConnectionType::Bluetooth,
                    connected: info.fConnected == true,
                    volume: 0.0,
                    muted: false,
                    supports_eq: false,
                    is_default: false,
                });
            }
            if (unsafe { BluetoothFindNextDevice(find, &mut info) }).is_err() {
                break;
            }
        }
        let _ = unsafe { BluetoothFindDeviceClose(find) };
        devices
    }

    /// Pairing is OS-managed (Windows handles PIN/confirmation prompts);
    /// there's no programmatic pairing API that's safe to call here. Left as
    /// a no-op so the command surface stays consistent with the WASAPI path.
    #[allow(dead_code)]
    pub fn pair(&self, _device_id: &str) -> Result<(), String> {
        Ok(())
    }

    /// Connecting is OS-managed: once paired, A2DP handoff happens when the
    /// device is selected as a render endpoint. No-op for the same reason.
    #[allow(dead_code)]
    pub fn connect(&self, _device_id: &str) -> Result<(), String> {
        Ok(())
    }
}

/// Decode a UTF-16 Bluetooth device name, trimmed at the first NUL.
fn bt_name(raw: &[u16; 248]) -> String {
    let len = raw.iter().position(|&c| c == 0).unwrap_or(raw.len());
    String::from_utf16_lossy(&raw[..len]).trim().to_string()
}

/// Bluetooth class-of-device audio check: major device class 0x04 is
/// "Audio/Video" (headset, headphones, loudspeaker, car audio, etc).
fn is_audio_class(class_of_device: u32) -> bool {
    ((class_of_device >> 8) & 0x1F) == 0x04
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_video_major_class_detected() {
        // 0x04 0x0414 => major 0x04 (Audio/Video), minor "Loudspeaker".
        assert!(is_audio_class(0x040414));
        // Generic computer / miscellaneous (major class 0x00).
        assert!(!is_audio_class(0x000508));
        // Phone major class (0x02) must not count as audio.
        assert!(!is_audio_class(0x020110));
    }

    #[test]
    fn name_trims_at_nul() {
        let mut raw = [0u16; 248];
        let name = "Minha Soundbar BT";
        for (i, c) in name.encode_utf16().enumerate() {
            raw[i] = c;
        }
        assert_eq!(bt_name(&raw), name);
    }

    #[test]
    fn empty_name_stays_empty() {
        assert_eq!(bt_name(&[0u16; 248]), "");
    }
}