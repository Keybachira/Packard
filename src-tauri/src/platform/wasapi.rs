use crate::hardware::{AudioDevice, ConnectionType};
use windows::core::PWSTR;
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eRender, EDataFlow, IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator,
    DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ,
};

/// Windows Audio Session API integration.
///
/// On Windows, soundbars/speakers/headsets plugged via USB or paired via
/// Bluetooth show up as normal audio render endpoints. This module enumerates
/// those endpoints with the Windows Core Audio COM APIs and reads/writes the
/// per-endpoint master volume.
#[derive(Debug, Default)]
pub struct Wasapi;

/// Ensure COM is initialized on the calling thread. Tauri commands can run on
/// different threadpool threads, so we call this at the top of every
/// WASAPI-touching function. `RPC_E_CHANGED_MODE`/`S_FALSE` (already
/// initialized) are both fine to ignore.
fn ensure_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

fn pwstr_to_string(p: PWSTR) -> String {
    unsafe { p.to_string().unwrap_or_default() }
}

/// Best-effort guess at how a device is connected, based on its friendly
/// name. Windows doesn't expose a simple USB/Bluetooth flag on the render
/// endpoint itself; the bus type lives behind extra property-store lookups
/// that vary a lot across drivers, so a name heuristic is the pragmatic
/// choice here.
fn guess_connection(name: &str) -> ConnectionType {
    let lower = name.to_lowercase();
    if lower.contains("bluetooth") || lower.contains("hands-free") {
        ConnectionType::Bluetooth
    } else if lower.contains("hdmi") {
        ConnectionType::Hdmi
    } else if lower.contains("dac") {
        ConnectionType::Dac
    } else if lower.contains("headphone")
        || lower.contains("headset")
        || lower.contains("earbud")
        || lower.contains("headphones")
    {
        ConnectionType::Headphones
    } else if lower.contains("microphone")
        || lower.contains("mic array")
        || lower.contains("audio array")
        || lower.contains("mic ")
    {
        ConnectionType::Microphone
    } else if lower.contains("interface") {
        ConnectionType::AudioInterface
    } else {
        ConnectionType::Usb
    }
}

impl Wasapi {
    pub fn new() -> Self {
        Self
    }

    fn enumerator() -> windows::core::Result<IMMDeviceEnumerator> {
        ensure_com();
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
    }

    fn device_by_id(enumerator: &IMMDeviceEnumerator, id: &str) -> windows::core::Result<IMMDevice> {
        let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe { enumerator.GetDevice(windows::core::PCWSTR(wide.as_ptr())) }
    }

    fn friendly_name(device: &IMMDevice) -> String {
        unsafe {
            let Ok(store) = device.OpenPropertyStore(STGM_READ) else {
                return "Dispositivo de Áudio".into();
            };
            let Ok(variant) = store.GetValue(&PKEY_Device_FriendlyName) else {
                return "Dispositivo de Áudio".into();
            };
            match PropVariantToStringAlloc(&variant) {
                Ok(pwstr) => {
                    let name = pwstr_to_string(pwstr);
                    CoTaskMemFree(Some(pwstr.0 as *const _));
                    if name.is_empty() {
                        "Dispositivo de Áudio".into()
                    } else {
                        name
                    }
                }
                Err(_) => "Dispositivo de Áudio".into(),
            }
        }
    }

    /// Enumerate active audio render endpoints (speakers, headphones, USB
    /// DACs, Bluetooth headsets, HDMI...). Each entry reflects the device's
    /// live volume/mute state.
    pub fn enumerate_render_endpoints(&self) -> Vec<AudioDevice> {
        self.enumerate_endpoints(eRender)
    }

    /// Enumerate active audio capture endpoints (microphones, mic arrays,
    /// audio interfaces with an input path). Each entry reflects the device's
    /// live volume/mute state; capture endpoints don't carry EQ.
    pub fn enumerate_capture_endpoints(&self) -> Vec<AudioDevice> {
        self.enumerate_endpoints(eCapture)
    }

    /// Enumerate all active endpoints of a given data-flow (render or
    /// capture), reading each device's friendly name, volume and mute state
    /// and classifying the connection from the name.
    fn enumerate_endpoints(&self, flow: EDataFlow) -> Vec<AudioDevice> {
        let Ok(enumerator) = Self::enumerator() else {
            return Vec::new();
        };

        let Ok(collection) = (unsafe { enumerator.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE) })
        else {
            return Vec::new();
        };
        let count = unsafe { collection.GetCount() }.unwrap_or(0);

        let mut devices = Vec::new();
        for i in 0..count {
            let Ok(device) = (unsafe { collection.Item(i) }) else {
                continue;
            };
            let Ok(id_pwstr) = (unsafe { device.GetId() }) else {
                continue;
            };
            let id = pwstr_to_string(id_pwstr);
            let name = Self::friendly_name(&device);
            let (volume, muted) = Self::read_endpoint_volume(&device).unwrap_or((0.72, false));
            let connection = guess_connection(&name);

            devices.push(AudioDevice {
                id,
                name,
                connection,
                connected: true,
                volume: (volume * 100.0).round(),
                muted,
                supports_eq: flow == eRender,
            });
        }

        devices
    }

    fn endpoint_volume(device: &IMMDevice) -> windows::core::Result<IAudioEndpointVolume> {
        unsafe { device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) }
    }

    fn read_endpoint_volume(device: &IMMDevice) -> windows::core::Result<(f32, bool)> {
        let ep = Self::endpoint_volume(device)?;
        unsafe {
            let vol = ep.GetMasterVolumeLevelScalar()?;
            let muted = ep.GetMute()?.as_bool();
            Ok((vol, muted))
        }
    }

    /// Set the master volume of an endpoint. `volume` is 0.0..1.0.
    pub fn set_endpoint_volume(&self, device_id: &str, volume: f32) -> Result<(), String> {
        let enumerator = Self::enumerator().map_err(|e| e.to_string())?;
        let device = Self::device_by_id(&enumerator, device_id).map_err(|e| e.to_string())?;
        let ep = Self::endpoint_volume(&device).map_err(|e| e.to_string())?;
        unsafe {
            ep.SetMasterVolumeLevelScalar(volume.clamp(0.0, 1.0), std::ptr::null())
                .map_err(|e| e.to_string())
        }
    }

    pub fn set_endpoint_mute(&self, device_id: &str, muted: bool) -> Result<(), String> {
        let enumerator = Self::enumerator().map_err(|e| e.to_string())?;
        let device = Self::device_by_id(&enumerator, device_id).map_err(|e| e.to_string())?;
        let ep = Self::endpoint_volume(&device).map_err(|e| e.to_string())?;
        unsafe { ep.SetMute(muted, std::ptr::null()).map_err(|e| e.to_string()) }
    }

    #[allow(dead_code)]
    pub fn get_endpoint_volume(&self, device_id: &str) -> Result<(f32, bool), String> {
        let enumerator = Self::enumerator().map_err(|e| e.to_string())?;
        let device = Self::device_by_id(&enumerator, device_id).map_err(|e| e.to_string())?;
        Self::read_endpoint_volume(&device).map_err(|e| e.to_string())
    }

    /// Resolve a WASAPI endpoint's friendly name for a given data-flow role,
    /// used to match against cpal's own device enumeration when starting
    /// playback on a specific (non-default) output device.
    #[allow(dead_code)]
    pub fn friendly_name_for(&self, device_id: &str, flow: EDataFlow) -> Option<String> {
        let _ = flow;
        let enumerator = Self::enumerator().ok()?;
        let device = Self::device_by_id(&enumerator, device_id).ok()?;
        Some(Self::friendly_name(&device))
    }
}
