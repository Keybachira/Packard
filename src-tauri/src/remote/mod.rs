//! Remote control (MVP): QR pairing + local axum HTTP/WebSocket server so a
//! phone on the same LAN can control the SoundCore desktop app.
pub mod hub;
pub mod lanip;
pub mod protocol;
pub mod server;
pub mod session;
pub mod snapshot;
