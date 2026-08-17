use rustfft::num_complex::Complex32;
use rustfft::FftPlanner;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

const TAP_CAPACITY: usize = 8192;

/// Rolling buffer of recently-played mono samples, fed by the playback
/// thread and read by the (Tauri-command-thread) spectrum/waveform
/// analysis, so FFT work never happens on the realtime audio thread.
pub struct AudioTap {
    buffer: Mutex<VecDeque<f32>>,
    /// Parallel L/R buffer, only populated for 2+ channel streams, kept
    /// alongside the mono downmix so the stereo-field analyzer (correlation,
    /// balance, width) can see both channels without redoing capture.
    stereo: Mutex<VecDeque<(f32, f32)>>,
    sample_rate: AtomicU32,
    pushed_frames: AtomicU64,
}

impl AudioTap {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            buffer: Mutex::new(VecDeque::with_capacity(TAP_CAPACITY)),
            stereo: Mutex::new(VecDeque::with_capacity(TAP_CAPACITY)),
            sample_rate: AtomicU32::new(48_000),
            pushed_frames: AtomicU64::new(0),
        })
    }

    /// Record the sample rate of the stream feeding this tap (used for FFT
    /// bin frequency mapping).
    pub fn set_sample_rate(&self, rate: u32) {
        self.sample_rate.store(rate.max(1), Ordering::Relaxed);
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate.load(Ordering::Relaxed)
    }

    /// Push a batch of interleaved multi-channel samples, downmixed to mono.
    /// For 2+ channel streams, also mirrors the raw L/R pair into the stereo
    /// buffer for the stereo-field analyzer.
    pub fn push(&self, interleaved: &[f32], channels: usize) {
        if channels == 0 || interleaved.is_empty() {
            return;
        }
        let Ok(mut buf) = self.buffer.lock() else {
            return;
        };
        for frame in interleaved.chunks(channels) {
            let mono = frame.iter().sum::<f32>() / frame.len() as f32;
            buf.push_back(mono);
        }
        while buf.len() > TAP_CAPACITY {
            buf.pop_front();
        }
        drop(buf);

        if channels >= 2 {
            if let Ok(mut stereo) = self.stereo.lock() {
                for frame in interleaved.chunks(channels) {
                    stereo.push_back((frame[0], frame[1]));
                }
                while stereo.len() > TAP_CAPACITY {
                    stereo.pop_front();
                }
            }
        }

        self.pushed_frames
            .fetch_add((interleaved.len() / channels) as u64, Ordering::Relaxed);
    }

    /// Total mono frames pushed so far (diagnostics).
    pub fn frames_pushed(&self) -> u64 {
        self.pushed_frames.load(Ordering::Relaxed)
    }

    /// Number of mono samples currently buffered (diagnostics).
    pub fn len(&self) -> usize {
        let Ok(buf) = self.buffer.lock() else {
            return 0;
        };
        buf.len()
    }

    pub fn snapshot(&self, n: usize) -> Vec<f32> {
        let Ok(buf) = self.buffer.lock() else {
            return Vec::new();
        };
        let len = buf.len();
        if len == 0 {
            return Vec::new();
        }
        let take = n.min(len);
        buf.iter().skip(len - take).copied().collect()
    }

    /// Most recent `n` L/R sample pairs, empty when the source is mono (or
    /// nothing has played yet).
    pub fn stereo_snapshot(&self, n: usize) -> Vec<(f32, f32)> {
        let Ok(buf) = self.stereo.lock() else {
            return Vec::new();
        };
        let len = buf.len();
        if len == 0 {
            return Vec::new();
        }
        let take = n.min(len);
        buf.iter().skip(len - take).copied().collect()
    }
}

const FFT_SIZE: usize = 2048;

/// Compute a `bins`-band log-scaled magnitude spectrum (0.0..1.0) from the
/// most recently played audio, using a windowed FFT. Returns `None` when
/// there isn't enough real audio buffered yet.
pub fn spectrum_bins(tap: &AudioTap, bins: usize, sample_rate: u32) -> Option<Vec<f32>> {
    let samples = tap.snapshot(FFT_SIZE);
    if samples.len() < FFT_SIZE / 2 || bins == 0 {
        return None;
    }

    let n = samples.len();
    let mut buffer: Vec<Complex32> = samples
        .iter()
        .enumerate()
        .map(|(i, &s)| {
            let w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (n.max(2) - 1) as f32).cos();
            Complex32::new(s * w, 0.0)
        })
        .collect();
    buffer.resize(FFT_SIZE, Complex32::new(0.0, 0.0));

    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);
    fft.process(&mut buffer);

    let half = FFT_SIZE / 2;
    let nyquist = (sample_rate as f32 / 2.0).max(1.0);
    let min_hz = 20.0f32;
    let max_hz = nyquist.min(20_000.0).max(min_hz + 1.0);

    let mut out = vec![0.0f32; bins];
    for (i, out_bin) in out.iter_mut().enumerate() {
        let t0 = i as f32 / bins as f32;
        let t1 = (i + 1) as f32 / bins as f32;
        let f0 = min_hz * (max_hz / min_hz).powf(t0);
        let f1 = min_hz * (max_hz / min_hz).powf(t1);
        let bin0 = (((f0 / nyquist) * half as f32).floor() as usize).min(half.saturating_sub(1));
        let bin1 = (((f1 / nyquist) * half as f32).ceil() as usize)
            .max(bin0 + 1)
            .min(half);

        let mut mag_sum = 0.0f32;
        let mut count = 0usize;
        for sample in &buffer[bin0..bin1] {
            mag_sum += sample.norm();
            count += 1;
        }
        let mag = if count > 0 { mag_sum / count as f32 } else { 0.0 };

        // Rough dB compression into a visually useful 0..1 range.
        let db = 20.0 * (mag + 1e-6).log10();
        *out_bin = ((db + 55.0) / 55.0).clamp(0.0, 1.0);
    }
    Some(out)
}

/// Latest raw waveform samples (-1.0..1.0 remapped to 0.0..1.0), for the
/// oscilloscope-style view.
pub fn waveform_samples(tap: &AudioTap, count: usize) -> Option<Vec<f32>> {
    let samples = tap.snapshot(count);
    if samples.len() < count / 2 {
        return None;
    }
    Some(samples.iter().map(|s| (s * 0.5 + 0.5).clamp(0.0, 1.0)).collect())
}

const BAND_WINDOW: usize = 2048;

/// Average per-band magnitude in dB across `samples`, one value per entry in
/// `centers_hz`, each read as roughly a third-octave window around that
/// center frequency. Splits `samples` into consecutive `BAND_WINDOW`-sized
/// FFT windows and averages across all of them, so a short transient doesn't
/// skew the read — used by Auto Calibration to turn a few seconds of
/// recorded room response into a stable per-band measurement.
pub fn band_levels_db(samples: &[f32], sample_rate: u32, centers_hz: &[f32]) -> Vec<f32> {
    if centers_hz.is_empty() || samples.len() < BAND_WINDOW {
        return vec![0.0; centers_hz.len()];
    }

    let half = BAND_WINDOW / 2;
    let nyquist = (sample_rate as f32 / 2.0).max(1.0);
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(BAND_WINDOW);

    let mut sums = vec![0.0f32; centers_hz.len()];
    let mut windows = 0usize;
    let mut offset = 0;
    while offset + BAND_WINDOW <= samples.len() {
        let chunk = &samples[offset..offset + BAND_WINDOW];
        let mut buffer: Vec<Complex32> = chunk
            .iter()
            .enumerate()
            .map(|(i, &s)| {
                let w = 0.5
                    - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (BAND_WINDOW - 1) as f32).cos();
                Complex32::new(s * w, 0.0)
            })
            .collect();
        fft.process(&mut buffer);

        for (i, &center) in centers_hz.iter().enumerate() {
            // Roughly a third-octave (±19%) window around the center freq.
            let lo = (center / 1.19).max(1.0);
            let hi = (center * 1.19).min(nyquist);
            let bin0 = (((lo / nyquist) * half as f32).floor() as usize).min(half.saturating_sub(1));
            let bin1 = (((hi / nyquist) * half as f32).ceil() as usize)
                .max(bin0 + 1)
                .min(half);
            let mag_sum: f32 = buffer[bin0..bin1].iter().map(|c| c.norm()).sum();
            let mag = mag_sum / (bin1 - bin0) as f32;
            sums[i] += 20.0 * (mag + 1e-6).log10();
        }
        windows += 1;
        offset += BAND_WINDOW;
    }

    if windows == 0 {
        return vec![0.0; centers_hz.len()];
    }
    sums.iter().map(|s| s / windows as f32).collect()
}

/// Real levels from the most recent audio: (peak 0..1, rms 0..1, lufs dBFS).
/// Returns `(0.0, 0.0, -70.0)` when no audio has been captured yet.
pub fn levels(tap: &AudioTap, window: usize) -> (f32, f32, f32) {
    let snap = tap.snapshot(window);
    if snap.is_empty() {
        return (0.0, 0.0, -70.0);
    }
    let peak = snap.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    let mean_sq = snap.iter().map(|s| s * s).sum::<f32>() / snap.len() as f32;
    let rms = mean_sq.sqrt();
    // Short-term loudness (approximation of ITU-R BS.1770 without gating).
    let lufs = 10.0 * (mean_sq + 1e-9).log10() - 0.691;
    (peak.min(1.0), rms.min(1.0), lufs.clamp(-70.0, 0.0))
}

/// Stereo-field metrics computed from the most recent L/R pairs.
pub struct StereoField {
    /// Phase correlation between channels: +1 identical (mono-compatible),
    /// 0 uncorrelated, -1 fully out of phase (cancels to silence in mono).
    pub correlation: f32,
    /// Channel balance from average level: -1 full left, 0 centered, +1
    /// full right.
    pub balance: f32,
    /// Side/mid energy ratio: 0 is mono, ~1 is a typically wide mix, capped
    /// at 2 for display.
    pub width: f32,
    /// True when the source has no separate L/R channels to analyze (mono
    /// capture, or nothing played yet).
    pub mono: bool,
}

/// Analyze the most recent `window` L/R sample pairs for phase correlation,
/// balance and stereo width.
pub fn stereo_field(tap: &AudioTap, window: usize) -> StereoField {
    let pairs = tap.stereo_snapshot(window);
    if pairs.is_empty() {
        return StereoField { correlation: 1.0, balance: 0.0, width: 0.0, mono: true };
    }

    let mut sum_l = 0.0f32;
    let mut sum_r = 0.0f32;
    let mut sum_ll = 0.0f32;
    let mut sum_rr = 0.0f32;
    let mut sum_lr = 0.0f32;
    let mut sum_mid_sq = 0.0f32;
    let mut sum_side_sq = 0.0f32;
    for &(l, r) in &pairs {
        sum_l += l.abs();
        sum_r += r.abs();
        sum_ll += l * l;
        sum_rr += r * r;
        sum_lr += l * r;
        let mid = (l + r) * 0.5;
        let side = (l - r) * 0.5;
        sum_mid_sq += mid * mid;
        sum_side_sq += side * side;
    }

    // Pearson-style correlation between channels.
    let denom = (sum_ll * sum_rr).sqrt();
    let correlation = if denom > 1e-9 { (sum_lr / denom).clamp(-1.0, 1.0) } else { 1.0 };

    // Balance from average absolute level per channel.
    let total = sum_l + sum_r;
    let balance = if total > 1e-9 { ((sum_r - sum_l) / total).clamp(-1.0, 1.0) } else { 0.0 };

    // Width: side energy relative to mid energy (0 = mono, ~1 = a typically
    // wide mix, capped at 2 for a sane meter range).
    let width = if sum_mid_sq > 1e-9 {
        (sum_side_sq / sum_mid_sq).sqrt().min(2.0)
    } else {
        0.0
    };

    StereoField { correlation, balance, width, mono: false }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_tap_reports_mono() {
        let tap = AudioTap::new();
        let field = stereo_field(&tap, 512);
        assert!(field.mono);
        assert_eq!(field.correlation, 1.0);
        assert_eq!(field.width, 0.0);
    }

    #[test]
    fn mono_channel_count_never_populates_stereo_buffer() {
        let tap = AudioTap::new();
        tap.push(&[0.1, 0.2, 0.3, 0.4], 1);
        assert!(tap.stereo_snapshot(16).is_empty());
    }

    #[test]
    fn identical_channels_are_fully_correlated_and_narrow() {
        let tap = AudioTap::new();
        let samples: Vec<f32> = (0..512)
            .flat_map(|i| {
                let v = (i as f32 * 0.05).sin();
                [v, v]
            })
            .collect();
        tap.push(&samples, 2);
        let field = stereo_field(&tap, 512);
        assert!(!field.mono);
        assert!(field.correlation > 0.99, "correlation was {}", field.correlation);
        assert!(field.width < 0.01, "width was {}", field.width);
    }

    #[test]
    fn inverted_right_channel_is_fully_anti_correlated() {
        let tap = AudioTap::new();
        let samples: Vec<f32> = (0..512)
            .flat_map(|i| {
                let v = (i as f32 * 0.05).sin();
                [v, -v]
            })
            .collect();
        tap.push(&samples, 2);
        let field = stereo_field(&tap, 512);
        assert!(field.correlation < -0.99, "correlation was {}", field.correlation);
    }

    #[test]
    fn right_only_signal_balances_fully_right() {
        let tap = AudioTap::new();
        let samples: Vec<f32> = (0..512)
            .flat_map(|i| {
                let v = (i as f32 * 0.05).sin();
                [0.0, v]
            })
            .collect();
        tap.push(&samples, 2);
        let field = stereo_field(&tap, 512);
        assert!(field.balance > 0.99, "balance was {}", field.balance);
    }

    #[test]
    fn band_levels_short_input_returns_zeros() {
        let centers = [100.0, 1000.0];
        let out = band_levels_db(&[0.0; 100], 48_000, &centers);
        assert_eq!(out, vec![0.0, 0.0]);
    }

    #[test]
    fn band_levels_finds_the_loudest_band_near_the_tone() {
        let sample_rate = 48_000u32;
        let tone_hz = 1000.0f32;
        let n = BAND_WINDOW * 4;
        let samples: Vec<f32> = (0..n)
            .map(|i| {
                (2.0 * std::f32::consts::PI * tone_hz * i as f32 / sample_rate as f32).sin()
            })
            .collect();

        let centers = [125.0, 1000.0, 8000.0];
        let levels = band_levels_db(&samples, sample_rate, &centers);
        let loudest = levels
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .map(|(i, _)| i)
            .unwrap();
        assert_eq!(loudest, 1, "expected the 1kHz band to be loudest, got levels {levels:?}");
    }
}
