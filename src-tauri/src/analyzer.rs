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
    sample_rate: AtomicU32,
    pushed_frames: AtomicU64,
}

impl AudioTap {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            buffer: Mutex::new(VecDeque::with_capacity(TAP_CAPACITY)),
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
