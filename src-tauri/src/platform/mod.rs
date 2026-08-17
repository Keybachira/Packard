/// Foreground-window / process detection for app-profile auto-switching.
pub mod foreground;
/// Windows-native audio integration (WASAPI + audio endpoint APIs).
pub mod wasapi;
/// System-wide audio capture (WASAPI loopback) for the realtime analyzer.
pub mod loopback;
/// One-shot microphone recording for the Auto Calibration flow.
pub mod mic;
/// Audio capture from the default input device (for continuous recognition).
pub mod capture;
