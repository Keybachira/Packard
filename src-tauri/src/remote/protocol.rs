use serde::{Deserialize, Serialize};

/// Commands sent by the mobile remote (WebSocket inbound).
///
/// Source of truth for the `Mobile → Desktop` half of the protocol. Every
/// message is a single JSON object tagged by `type`:
///
/// ```json
/// { "type": "cmd.volume.set", "value": 42 }
/// ```
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum RemoteCommand {
    #[serde(rename = "cmd.volume.set")]
    VolumeSet { value: f32 },
    #[serde(rename = "cmd.volume.increment")]
    VolumeIncrement,
    #[serde(rename = "cmd.volume.decrement")]
    VolumeDecrement,
    #[serde(rename = "cmd.volume.mute")]
    VolumeMute,
    #[serde(rename = "cmd.volume.unmute")]
    VolumeUnmute,
    #[serde(rename = "cmd.player.play")]
    PlayerPlay,
    #[serde(rename = "cmd.player.pause")]
    PlayerPause,
    #[serde(rename = "cmd.player.next")]
    PlayerNext,
    #[serde(rename = "cmd.player.previous")]
    PlayerPrevious,
    /// Replace the 10 EQ gains of the active device (V2).
    #[serde(rename = "cmd.eq.set")]
    EqSet { gains: Vec<f32> },
    /// Apply a named preset (FLAT | CINEMA | MUSIC | GAME) to the active
    /// device (V2).
    #[serde(rename = "cmd.preset.apply")]
    PresetApply { name: String },
    /// Switch the active sound device (V2).
    #[serde(rename = "cmd.device.set", rename_all = "camelCase")]
    DeviceSet { device_id: String },
    #[serde(rename = "cmd.system.ping")]
    SystemPing,
    #[serde(rename = "cmd.state.request")]
    StateRequest,
    /// Internal: tells this connection to close (sent by "Desconectar todos").
    #[serde(rename = "system.disconnect")]
    SystemDisconnect,
}

/// Events/state pushed by the desktop to connected remotes (WebSocket outbound).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum RemoteEvent {
    #[serde(rename = "state.snapshot")]
    StateSnapshot { state: SoundCoreState },
    /// Volume/mute changed while a phone is paired. Not sent in the MVP (the
    /// full snapshot already carries both), kept as the documented wire event.
    #[serde(rename = "state.volume")]
    #[allow(dead_code)]
    StateVolume { value: f32 },
    #[serde(rename = "state.muted")]
    #[allow(dead_code)]
    StateMuted { value: bool },
    #[serde(rename = "state.playback")]
    StatePlayback { playback: RemotePlayback },
    /// Live normalized spectrum bins (0.0..1.0) pushed ~7×/s while a remote is
    /// connected, driving the phone's analyzer page (V2).
    #[serde(rename = "state.analyzer")]
    StateAnalyzer { bins: Vec<f32> },
    #[serde(rename = "event.paired", rename_all = "camelCase")]
    EventPaired { remote_id: String },
    #[serde(rename = "error")]
    Error { message: String },
    /// Tells every remote to drop the connection ("Desconectar todos").
    #[serde(rename = "system.disconnect")]
    SystemDisconnect,
    /// Internal broadcast: every connection handler sees this, but only the
    /// one whose `remote_id` matches actually disconnects (translated to
    /// `system.disconnect` on the wire, so the JS client never has to know
    /// about this variant — see `handle_socket`).
    #[serde(rename = "system.kick", rename_all = "camelCase")]
    KickClient { remote_id: String },
}

/// Minimal view of the currently active sound device, exposed to remotes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDevice {
    pub id: String,
    pub name: String,
    pub connected: bool,
}

/// Playback metadata + position, derived from the existing `MusicEngine`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePlayback {
    pub playing: bool,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub position_secs: f32,
    pub duration_secs: f32,
}

/// EQ state (10 peaking-band gains in dB) plus the active preset name, exposed
/// so the phone can render its equalizer and preset chips.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEq {
    pub gains: Vec<f32>,
    pub preset: String,
    pub supports_eq: bool,
}

/// One entry in the remote's device switcher. `active` mirrors the device the
/// snapshot is currently targeting.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDeviceInfo {
    pub id: String,
    pub name: String,
    pub connection: String,
    pub connected: bool,
    pub active: bool,
}

/// Snapshot of everything a remote needs to render its screens. The
/// `active_profile` field is `None` in the MVP (no profile source exists yet).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundCoreState {
    pub device: Option<RemoteDevice>,
    pub volume: f32,
    pub muted: bool,
    pub playback: RemotePlayback,
    pub active_profile: Option<String>,
    pub eq: RemoteEq,
    pub devices: Vec<RemoteDeviceInfo>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_set_round_trip() {
        let cmd: RemoteCommand =
            serde_json::from_str(r#"{"type":"cmd.volume.set","value":42.0}"#).unwrap();
        assert!(matches!(cmd, RemoteCommand::VolumeSet { value } if value == 42.0));
    }

    #[test]
    fn unit_commands_round_trip() {
        for ty in [
            "cmd.volume.increment",
            "cmd.volume.decrement",
            "cmd.volume.mute",
            "cmd.volume.unmute",
            "cmd.player.play",
            "cmd.player.pause",
            "cmd.player.next",
            "cmd.player.previous",
            "cmd.system.ping",
            "cmd.state.request",
            "system.disconnect",
        ] {
            let cmd: RemoteCommand =
                serde_json::from_str(&format!(r#"{{"type":"{ty}"}}"#)).expect(ty);
            assert!(matches!(cmd, RemoteCommand::SystemPing | RemoteCommand::StateRequest | RemoteCommand::PlayerPlay | RemoteCommand::PlayerPause | RemoteCommand::PlayerNext | RemoteCommand::PlayerPrevious | RemoteCommand::VolumeIncrement | RemoteCommand::VolumeDecrement | RemoteCommand::VolumeMute | RemoteCommand::VolumeUnmute | RemoteCommand::SystemDisconnect));
        }
    }

    #[test]
    fn snapshot_serializes_with_type_tag() {
        let st = SoundCoreState {
            device: Some(RemoteDevice {
                id: "d1".into(),
                name: "Demo".into(),
                connected: true,
            }),
            volume: 50.0,
            muted: false,
            playback: RemotePlayback {
                playing: false,
                title: None,
                artist: None,
                album: None,
                position_secs: 0.0,
                duration_secs: 0.0,
            },
            active_profile: None,
            eq: RemoteEq {
                gains: vec![0.0; 10],
                preset: "FLAT".into(),
                supports_eq: true,
            },
            devices: vec![RemoteDeviceInfo {
                id: "d1".into(),
                name: "Demo".into(),
                connection: "usb".into(),
                connected: true,
                active: true,
            }],
        };
        let json = serde_json::to_value(RemoteEvent::StateSnapshot { state: st }).unwrap();
        assert_eq!(json["type"], "state.snapshot");
        assert_eq!(json["state"]["volume"], 50.0);
        assert_eq!(json["state"]["device"]["id"], "d1");
        assert_eq!(json["state"]["eq"]["gains"].as_array().unwrap().len(), 10);
        assert_eq!(json["state"]["devices"][0]["active"], true);
    }

    #[test]
    fn v2_commands_round_trip() {
        let eq: RemoteCommand =
            serde_json::from_str(r#"{"type":"cmd.eq.set","gains":[1.0,2.0,3.0]}"#).unwrap();
        assert!(matches!(eq, RemoteCommand::EqSet { ref gains } if gains.len() == 3));

        let preset: RemoteCommand =
            serde_json::from_str(r#"{"type":"cmd.preset.apply","name":"CINEMA"}"#).unwrap();
        assert!(matches!(preset, RemoteCommand::PresetApply { ref name } if name == "CINEMA"));

        let device: RemoteCommand =
            serde_json::from_str(r#"{"type":"cmd.device.set","deviceId":"d2"}"#).unwrap();
        assert!(matches!(device, RemoteCommand::DeviceSet { ref device_id } if device_id == "d2"));
    }

    #[test]
    fn analyzer_event_serializes_bins() {
        let json = serde_json::to_value(RemoteEvent::StateAnalyzer {
            bins: vec![0.0, 0.5, 1.0],
        })
        .unwrap();
        assert_eq!(json["type"], "state.analyzer");
        assert_eq!(json["bins"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn paired_event_uses_camel_case_id() {
        let json = serde_json::to_value(RemoteEvent::EventPaired {
            remote_id: "abc".into(),
        })
        .unwrap();
        assert_eq!(json["type"], "event.paired");
        assert_eq!(json["remoteId"], "abc");
    }

    #[test]
    fn unknown_command_is_error() {
        let res: Result<RemoteCommand, _> = serde_json::from_str(r#"{"type":"cmd.bogus"}"#);
        assert!(res.is_err());
    }
}
