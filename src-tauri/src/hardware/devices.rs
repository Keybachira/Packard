use crate::hardware::{AudioDevice, ConnectionType};
use std::collections::HashMap;

/// Registry of devices known to the app. Backed by a simple in-memory map for
/// now; replace the insert/get logic with real enumeration as the USB/Bluetooth
/// backends come online.
#[derive(Debug, Default)]
pub struct DeviceRegistry {
    devices: HashMap<String, AudioDevice>,
}

impl DeviceRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, device: AudioDevice) {
        self.devices.insert(device.id.clone(), device);
    }

    #[allow(dead_code)]
    pub fn get(&self, id: &str) -> Option<&AudioDevice> {
        self.devices.get(id)
    }

    #[allow(dead_code)]
    pub fn get_mut(&mut self, id: &str) -> Option<&mut AudioDevice> {
        self.devices.get_mut(id)
    }

    pub fn list(&self) -> Vec<AudioDevice> {
        let mut list: Vec<AudioDevice> = self.devices.values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.devices.clear();
    }

    /// Seed with a placeholder so the UI has something to show before the
    /// hardware enumeration is implemented.
    pub fn seed_demo(&mut self) {
        if self.devices.is_empty() {
            let mut demo = AudioDevice::offline("demo-soundbar", "Soundbar X1", ConnectionType::Usb);
            demo.connected = true;
            demo.volume = 72.0;
            demo.supports_eq = true;
            self.insert(demo);
        }
    }
}