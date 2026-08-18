pub mod compressor;
pub mod equalizer;
pub mod limiter;
pub mod optimize;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Full set of Audio Lab parameters. Everything is stored so the frontend can
/// render its current state; the DSP chain applies what is meaningful in
/// software (preamp/gain, loudness, EQ shelves, compressor, limiter, and —
/// for stereo sources — balance, stereo width and spatial widening via
/// `process_stereo`). The remaining knobs (crossfeed, noise reduction) are
/// forwarded to the hardware backend when it is implemented.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AudioLabParams {
    /// 10-band EQ gains in dB (-12..+12).
    pub eq: Vec<f32>,
    /// Extra low-shelf boost in dB (0..+12).
    pub bass: f32,
    /// Extra high-shelf boost in dB (0..+12).
    pub treble: f32,
    /// Left/right balance, -100 (left) .. +100 (right).
    pub balance: f32,
    /// Bass-heavy loudness curve.
    pub loudness: bool,
    pub compressor: bool,
    pub limiter: bool,
    /// 0..100, placeholder for the hardware noise-reduction engine.
    pub noise_reduction: f32,
    /// 0..200 (percent). Placeholder for hardware / DSP widening.
    pub stereo_width: f32,
    pub spatial: bool,
    /// 0..100. Placeholder for the crossfeed engine.
    pub crossfeed: f32,
    /// Post-EQ gain in dB (-12..+12).
    pub gain: f32,
    /// Pre-EQ trim in dB (-12..+12).
    pub preamp: f32,
}

impl Default for AudioLabParams {
    fn default() -> Self {
        Self {
            eq: vec![0.0; equalizer::BAND_FREQUENCIES.len()],
            bass: 0.0,
            treble: 0.0,
            balance: 0.0,
            loudness: false,
            compressor: false,
            limiter: true,
            noise_reduction: 0.0,
            stereo_width: 100.0,
            spatial: false,
            crossfeed: 0.0,
            gain: 0.0,
            preamp: 0.0,
        }
    }
}

/// Central DSP state owned by the app, shared across the UI thread and the
/// audio capture thread via an `AppState`. Several fields are only consumed by
/// the not-yet-wired WASAPI capture loop.
#[allow(dead_code)]
pub struct DspEngine {
    pub equalizer: equalizer::Equalizer,
    pub compressor: compressor::Compressor,
    pub limiter: limiter::Limiter,
    pub params: AudioLabParams,
    /// Latest realtime spectrum bins (log-scaled, 0.0..1.0), written by the
    /// WASAPI capture loop and read by the UI.
    pub spectrum: Mutex<Vec<f32>>,
    /// Latest waveform samples (0.0..1.0), used by the realtime analyzer.
    pub waveform: Mutex<Vec<f32>>,
    pub sample_rate: u32,
}

impl DspEngine {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            equalizer: equalizer::Equalizer::default(),
            compressor: compressor::Compressor::default(),
            limiter: limiter::Limiter::default(),
            params: AudioLabParams::default(),
            spectrum: Mutex::new(vec![0.0; 48]),
            waveform: Mutex::new(vec![0.0; 512]),
            sample_rate,
        }
    }

    /// Apply a full Audio Lab parameter set to the engine, rebuilding the EQ
    /// filters from the band gains plus the bass/treble shelves.
    pub fn apply_params(&mut self, params: AudioLabParams) {
        self.params = params.clone();
        self.rebuild_eq();
    }

    /// Rebuild the EQ filters from the stored band gains + bass/treble shelves.
    pub fn rebuild_eq(&mut self) {
        let mut effective: Vec<f32> = self.params.eq.clone();
        let n = effective.len();
        // Bass shelf boosts the two lowest bands, treble the two highest.
        if n >= 4 {
            effective[0] += self.params.bass;
            effective[1] += self.params.bass * 0.6;
            effective[n - 1] += self.params.treble;
            effective[n - 2] += self.params.treble * 0.6;
        }
        let sr = self.sample_rate;
        self.equalizer.set_gains(&effective, sr);
    }

    /// Process a single interleaved audio frame through the full chain.
    #[inline]
    pub fn process_frame(&mut self, input: f32) -> f32 {
        // Preamp + gain (linear multiplier from dB).
        let trim_db = self.params.preamp + self.params.gain;
        let mut sample = input * 10f32.powf(trim_db / 20.0);

        // Simple loudness curve: push a little bottom end when enabled.
        if self.params.loudness {
            sample *= 1.08;
        }

        sample = self.equalizer.process(sample);
        sample = self.compressor.process(sample);
        sample = self.limiter.process(sample);
        sample
    }
}

/// Reshape an already-processed stereo pair (post EQ/compressor/limiter,
/// which run independently per channel) using balance, stereo width and a
/// cheap spatial widening bump. All three operate on the same mid/side
/// decomposition, so they're applied together after the mono chain rather
/// than inside `process_frame`, which never sees both channels at once.
pub fn process_stereo(params: &AudioLabParams, left: f32, right: f32) -> (f32, f32) {
    // Balance: -100 (full left) .. 0 (center) .. +100 (full right). Attenuates
    // the opposite channel, like a physical balance knob.
    let bal = (params.balance / 100.0).clamp(-1.0, 1.0);
    let mut l = left * (1.0 - bal.max(0.0));
    let mut r = right * (1.0 + bal.min(0.0));

    // Stereo width via mid/side scaling: 0% collapses to mono, 100% is
    // untouched, 200% doubles the side signal for a wider image.
    let width = (params.stereo_width / 100.0).max(0.0);
    let mid = (l + r) * 0.5;
    let side = (l - r) * 0.5 * width;
    l = mid + side;
    r = mid - side;

    // Spatial: an extra side-signal boost on top of the width control,
    // pending real HRTF/hardware spatial processing.
    if params.spatial {
        let mid = (l + r) * 0.5;
        let side = (l - r) * 0.5 * 1.35;
        l = mid + side;
        r = mid - side;
    }

    (l, r)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params_with(patch: impl FnOnce(&mut AudioLabParams)) -> AudioLabParams {
        let mut p = AudioLabParams::default();
        patch(&mut p);
        p
    }

    #[test]
    fn default_params_leave_stereo_pair_untouched() {
        let params = AudioLabParams::default();
        let (l, r) = process_stereo(&params, 0.4, -0.2);
        assert!((l - 0.4).abs() < 1e-6);
        assert!((r - (-0.2)).abs() < 1e-6);
    }

    #[test]
    fn zero_width_collapses_to_mono() {
        let params = params_with(|p| p.stereo_width = 0.0);
        let (l, r) = process_stereo(&params, 1.0, -1.0);
        assert!((l - 0.0).abs() < 1e-6);
        assert!((r - 0.0).abs() < 1e-6);
    }

    #[test]
    fn full_right_balance_silences_left_channel() {
        let params = params_with(|p| p.balance = 100.0);
        let (l, r) = process_stereo(&params, 0.5, 0.5);
        assert!((l - 0.0).abs() < 1e-6);
        assert!((r - 0.5).abs() < 1e-6);
    }

    #[test]
    fn spatial_widens_the_side_signal() {
        let narrow = process_stereo(&AudioLabParams::default(), 0.5, 0.1);
        let wide = process_stereo(&params_with(|p| p.spatial = true), 0.5, 0.1);
        let narrow_spread = (narrow.0 - narrow.1).abs();
        let wide_spread = (wide.0 - wide.1).abs();
        assert!(wide_spread > narrow_spread);
    }
}
