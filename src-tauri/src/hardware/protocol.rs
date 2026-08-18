//! Vendor-agnostic DSP communication layer.
//!
//! The soundbar's real command protocol is vendor-specific and unknown until
//! the hardware is documented or reverse-engineered. This module defines the
//! *shape* of the protocol (the [`VendorCodec`] trait) plus a documented,
//! deterministic example codec ([`SimulatedCodec`]) that:
//!   * gives the app something testable end-to-end today, and
//!   * is the drop-in replacement point once the real VID/PID + wire format
//!     are known (implement [`VendorCodec`] and hand it to `UsbBackend`).

use crate::hardware::SubwooferState;
use serde::{Deserialize, Serialize};

/// EQ/power presets exposed by the DSP.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Preset {
    Flat,
    Cinema,
    Music,
    Game,
}

impl Preset {
    /// Map an app preset string ("FLAT"/"CINEMA"/"MUSIC"/"GAME") to a
    /// protocol preset. Used by the UI-facing preset names; kept here so a
    /// real vendor codec can reuse the same mapping.
    #[allow(dead_code)]
    pub fn from_name(name: &str) -> Option<Preset> {
        match name {
            "FLAT" => Some(Preset::Flat),
            "CINEMA" => Some(Preset::Cinema),
            "MUSIC" => Some(Preset::Music),
            "GAME" => Some(Preset::Game),
            _ => None,
        }
    }

    #[allow(dead_code)]
    pub fn as_name(self) -> &'static str {
        match self {
            Preset::Flat => "FLAT",
            Preset::Cinema => "CINEMA",
            Preset::Music => "MUSIC",
            Preset::Game => "GAME",
        }
    }

    pub fn index(self) -> u8 {
        match self {
            Preset::Flat => 0,
            Preset::Cinema => 1,
            Preset::Music => 2,
            Preset::Game => 3,
        }
    }

    pub fn from_index(i: u8) -> Option<Preset> {
        match i {
            0 => Some(Preset::Flat),
            1 => Some(Preset::Cinema),
            2 => Some(Preset::Music),
            3 => Some(Preset::Game),
            _ => None,
        }
    }
}

/// A single command the app can send to the DSP/firmware.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum Command {
    Power(bool),
    Volume(u8),
    Mute(bool),
    Eq(Vec<i8>),
    Preset(Preset),
    Subwoofer(SubwooferState),
    /// Ask the device to report its full state.
    Status,
}

/// Mirror of the device's DSP state, decoded from a status report.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DspStatus {
    pub power: bool,
    pub volume: u8,
    pub muted: bool,
    pub eq: Vec<i8>,
    pub preset: Preset,
    pub subwoofer: SubwooferState,
}

impl Default for DspStatus {
    fn default() -> Self {
        Self {
            power: true,
            volume: 72,
            muted: false,
            eq: vec![0; 10],
            preset: Preset::Flat,
            subwoofer: SubwooferState {
                gain: 0.0,
                frequency: 80.0,
                phase: 0,
                enabled: true,
            },
        }
    }
}

/// Pluggable encoder/decoder for a concrete vendor's wire format.
///
/// `encode`/`decode` move commands onto/off the wire; `encode_status`/
/// `decode_status` serialize/parse the device's state report. The pair must
/// round-trip so a simulation can be tested against a real implementation.
pub trait VendorCodec: Send + Sync {
    /// The USB VID/PID this codec speaks to, if known.
    fn vendor_id(&self) -> Option<(u16, u16)>;
    fn encode(&self, cmd: &Command) -> Vec<u8>;
    /// Reverse of [`VendorCodec::encode`]; exercised by the simulation device
    /// and tests, and required by a real vendor codec.
    #[allow(dead_code)]
    fn decode(&self, report: &[u8]) -> Option<Command>;
    /// Serialize a device state report; the counterpart of
    /// [`VendorCodec::decode_status`].
    #[allow(dead_code)]
    fn encode_status(&self, status: &DspStatus) -> Vec<u8>;
    fn decode_status(&self, report: &[u8]) -> Option<DspStatus>;
}

/// Example/documented codec: 64-byte HID reports.
///
/// Frame layout (bytes 0..63 payload, byte 63 = XOR checksum of 0..63):
///   [0]  command tag:
///          0x10 POWER     [1] 0/1
///          0x11 VOLUME    [1] 0..=100
///          0x12 MUTE      [1] 0/1
///          0x13 EQ        [1..11] 10 x i8 band gains
///          0x14 PRESET    [1] 0..=3
///          0x15 SUBWOOFER [1] enabled, [2] gain i8 dB, [3..5] frequency u16 LE Hz, [5] phase
///          0x7F STATUS    (request)
///   STATUS response:
///          [1] power, [2] volume, [3] muted, [4..14] eq, [14] preset,
///          [15] sw enabled, [16] sw gain, [17..19] sw frequency LE, [19] sw phase
///
/// This is a stand-in for the real vendor format: swap in another
/// [`VendorCodec`] implementation once the hardware protocol is known.
#[derive(Debug, Default)]
pub struct SimulatedCodec;

impl VendorCodec for SimulatedCodec {
    fn vendor_id(&self) -> Option<(u16, u16)> {
        None
    }

    fn encode(&self, cmd: &Command) -> Vec<u8> {
        let mut frame = [0u8; 64];
        match cmd {
            Command::Power(on) => {
                frame[0] = 0x10;
                frame[1] = u8::from(*on);
            }
            Command::Volume(v) => {
                frame[0] = 0x11;
                frame[1] = (*v).min(100);
            }
            Command::Mute(m) => {
                frame[0] = 0x12;
                frame[1] = u8::from(*m);
            }
            Command::Eq(gains) => {
                frame[0] = 0x13;
                for (i, g) in gains.iter().take(10).enumerate() {
                    frame[1 + i] = *g as u8;
                }
            }
            Command::Preset(p) => {
                frame[0] = 0x14;
                frame[1] = p.index();
            }
            Command::Subwoofer(sw) => {
                frame[0] = 0x15;
                frame[1] = u8::from(sw.enabled);
                frame[2] = sw.gain.round().clamp(-20.0, 20.0) as i8 as u8;
                let freq = (sw.frequency.round().clamp(0.0, 1000.0) as u16).to_le_bytes();
                frame[3] = freq[0];
                frame[4] = freq[1];
                frame[5] = sw.phase;
            }
            Command::Status => {
                frame[0] = 0x7F;
            }
        }
        let checksum = frame[..63].iter().fold(0u8, |acc, b| acc ^ b);
        frame[63] = checksum;
        frame.to_vec()
    }

    fn decode(&self, report: &[u8]) -> Option<Command> {
        if report.len() < 64 {
            return None;
        }
        let checksum = report[..63].iter().fold(0u8, |acc, b| acc ^ b);
        if checksum != report[63] {
            return None;
        }
        match report[0] {
            0x10 => Some(Command::Power(report[1] != 0)),
            0x11 => Some(Command::Volume(report[1].min(100))),
            0x12 => Some(Command::Mute(report[1] != 0)),
            0x13 => Some(Command::Eq(
                report[1..11].iter().map(|&b| b as i8).collect(),
            )),
            0x14 => Preset::from_index(report[1]).map(Command::Preset),
            0x15 => {
                let freq = u16::from_le_bytes([report[3], report[4]]);
                Some(Command::Subwoofer(SubwooferState {
                    enabled: report[1] != 0,
                    gain: report[2] as i8 as f32,
                    frequency: freq as f32,
                    phase: report[5],
                }))
            }
            0x7F => Some(Command::Status),
            _ => None,
        }
    }

    fn encode_status(&self, status: &DspStatus) -> Vec<u8> {
        let mut frame = [0u8; 64];
        frame[0] = 0x7F;
        frame[1] = u8::from(status.power);
        frame[2] = status.volume.min(100);
        frame[3] = u8::from(status.muted);
        for (i, g) in status.eq.iter().take(10).enumerate() {
            frame[4 + i] = *g as u8;
        }
        frame[14] = status.preset.index();
        frame[15] = u8::from(status.subwoofer.enabled);
        frame[16] = status.subwoofer.gain.round().clamp(-20.0, 20.0) as i8 as u8;
        let freq = (status.subwoofer.frequency.round().clamp(0.0, 1000.0) as u16).to_le_bytes();
        frame[17] = freq[0];
        frame[18] = freq[1];
        frame[19] = status.subwoofer.phase;
        let checksum = frame[..63].iter().fold(0u8, |acc, b| acc ^ b);
        frame[63] = checksum;
        frame.to_vec()
    }

    fn decode_status(&self, report: &[u8]) -> Option<DspStatus> {
        if report.len() < 64 || report[0] != 0x7F {
            return None;
        }
        let checksum = report[..63].iter().fold(0u8, |acc, b| acc ^ b);
        if checksum != report[63] {
            return None;
        }
        let freq = u16::from_le_bytes([report[17], report[18]]);
        Some(DspStatus {
            power: report[1] != 0,
            volume: report[2].min(100),
            muted: report[3] != 0,
            eq: report[4..14].iter().map(|&b| b as i8).collect(),
            preset: Preset::from_index(report[14])?,
            subwoofer: SubwooferState {
                enabled: report[15] != 0,
                gain: report[16] as i8 as f32,
                frequency: freq as f32,
                phase: report[19],
            },
        })
    }
}

/// In-memory stand-in for the soundbar firmware. Applies decoded commands and
/// answers status requests, so the full encode -> transport -> device ->
/// status loop is testable without hardware.
///
/// Excluded from the release build on purpose: it exists to exercise the
/// codec/transport path in tests, not to ship in the binary.
#[cfg(test)]
#[derive(Debug)]
pub struct SimulatedDevice {
    pub status: DspStatus,
    codec: SimulatedCodec,
}

#[cfg(test)]
impl SimulatedDevice {
    pub fn new() -> Self {
        Self {
            status: DspStatus::default(),
            codec: SimulatedCodec,
        }
    }

    pub fn apply(&mut self, cmd: &Command) {
        match cmd {
            Command::Power(on) => self.status.power = *on,
            Command::Volume(v) => self.status.volume = (*v).min(100),
            Command::Mute(m) => self.status.muted = *m,
            Command::Eq(gains) => {
                self.status.eq = gains.iter().take(10).copied().collect();
                while self.status.eq.len() < 10 {
                    self.status.eq.push(0);
                }
            }
            Command::Preset(p) => self.status.preset = *p,
            Command::Subwoofer(sw) => self.status.subwoofer = sw.clone(),
            Command::Status => {}
        }
    }

    pub fn status_report(&self) -> Vec<u8> {
        self.codec.encode_status(&self.status)
    }

    /// Ingest a raw report (as received over HID): status requests are answered
    /// with the current state; everything else updates the device state and
    /// returns `None`.
    pub fn handle(&mut self, report: &[u8]) -> Option<Vec<u8>> {
        let cmd = self.codec.decode(report)?;
        if matches!(cmd, Command::Status) {
            Some(self.status_report())
        } else {
            self.apply(&cmd);
            None
        }
    }
}

#[cfg(test)]
impl Default for SimulatedDevice {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrips_commands() {
        let codec = SimulatedCodec;
        let cases = vec![
            Command::Power(true),
            Command::Power(false),
            Command::Volume(0),
            Command::Volume(42),
            Command::Mute(true),
            Command::Eq(vec![0, 1, -2, 3, -4, 5, -6, 7, -8, 9]),
            Command::Preset(Preset::Cinema),
            Command::Preset(Preset::Game),
            Command::Subwoofer(SubwooferState {
                enabled: false,
                gain: -3.0,
                frequency: 120.0,
                phase: 1,
            }),
            Command::Status,
        ];
        for cmd in cases {
            let expected = cmd.clone();
            let decoded = codec.decode(&codec.encode(&cmd)).expect("decode");
            assert_eq!(decoded, expected, "roundtrip {cmd:?}");
        }
    }

    #[test]
    fn volume_is_clamped_to_max() {
        let codec = SimulatedCodec;
        let decoded = codec.decode(&codec.encode(&Command::Volume(255))).unwrap();
        assert_eq!(decoded, Command::Volume(100));
    }

    #[test]
    fn status_roundtrips_through_wire_format() {
        let codec = SimulatedCodec;
        let status = DspStatus {
            power: false,
            volume: 33,
            muted: true,
            eq: vec![1, -1, 2, -2, 3, -3, 4, -4, 5, -5],
            preset: Preset::Music,
            subwoofer: SubwooferState {
                enabled: false,
                gain: 2.0,
                frequency: 95.0,
                phase: 2,
            },
        };
        let decoded = codec.decode_status(&codec.encode_status(&status)).unwrap();
        assert_eq!(decoded, status);
    }

    #[test]
    fn checksum_corruption_is_detected() {
        let codec = SimulatedCodec;
        let mut report = codec.encode_status(&DspStatus::default());
        report[5] ^= 0xFF;
        assert!(codec.decode_status(&report).is_none());
        let mut cmd = codec.encode(&Command::Volume(50));
        cmd[20] ^= 0xFF;
        assert!(codec.decode(&cmd).is_none());
    }

    #[test]
    fn simulated_device_applies_commands_and_answers_status() {
        let mut device = SimulatedDevice::new();
        let codec = SimulatedCodec;
        device.handle(&codec.encode(&Command::Volume(42)));
        device.handle(&codec.encode(&Command::Mute(true)));
        device.handle(&codec.encode(&Command::Preset(Preset::Cinema)));

        let reply = device
            .handle(&codec.encode(&Command::Status))
            .expect("status request answered");
        let status = codec.decode_status(&reply).unwrap();
        assert_eq!(status.volume, 42);
        assert!(status.muted);
        assert_eq!(status.preset, Preset::Cinema);
    }

    #[test]
    fn command_json_shape_used_by_hardware_command() {
        // Contract for the `hardware_command` Tauri command (and its frontend
        // types): adjacent tagging — `type` + `value`.
        assert_eq!(
            serde_json::to_value(Command::Volume(42)).unwrap(),
            serde_json::json!({ "type": "volume", "value": 42 })
        );
        assert_eq!(
            serde_json::to_value(Command::Power(false)).unwrap(),
            serde_json::json!({ "type": "power", "value": false })
        );
        assert_eq!(
            serde_json::to_value(Command::Preset(Preset::Game)).unwrap(),
            serde_json::json!({ "type": "preset", "value": "game" })
        );
        assert_eq!(
            serde_json::to_value(Command::Status).unwrap(),
            serde_json::json!({ "type": "status" })
        );
        let decoded: Command = serde_json::from_value(serde_json::json!({ "type": "status" }))
            .expect("status parses");
        assert_eq!(decoded, Command::Status);
        let decoded_volume: Command =
            serde_json::from_value(serde_json::json!({ "type": "volume", "value": 30 }))
                .expect("volume parses");
        assert_eq!(decoded_volume, Command::Volume(30));
    }
}