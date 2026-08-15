/// Foreground-window / process detection for app-profile auto-switching.
pub mod foreground;
/// Windows-native audio integration (WASAPI + audio endpoint APIs).
pub mod wasapi;
/// System-wide audio capture (WASAPI loopback) for the realtime analyzer.
pub mod loopback;
