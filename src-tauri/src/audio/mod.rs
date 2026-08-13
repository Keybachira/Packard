pub mod compressor;
pub mod equalizer;
pub mod limiter;

use std::sync::Mutex;

/// Central DSP state owned by the app, shared across the UI thread and the
/// audio capture thread via an `AppState`.
pub struct DspEngine {
    pub equalizer: equalizer::Equalizer,
    pub compressor: compressor::Compressor,
    pub limiter: limiter::Limiter,
    /// Latest realtime spectrum bins (log-scaled, 0.0..1.0), written by the
    /// WASAPI capture loop and read by the UI.
    pub spectrum: Mutex<Vec<f32>>,
    pub sample_rate: u32,
}

impl DspEngine {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            equalizer: equalizer::Equalizer::default(),
            compressor: compressor::Compressor::default(),
            limiter: limiter::Limiter::default(),
            spectrum: Mutex::new(Vec::new()),
            sample_rate,
        }
    }

    /// Process a single interleaved audio frame through the full chain.
    #[inline]
    pub fn process_frame(&mut self, input: f32) -> f32 {
        let mut sample = input;
        sample = self.equalizer.process(sample);
        sample = self.compressor.process(sample);
        sample = self.limiter.process(sample);
        sample
    }
}
