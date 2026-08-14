use rustfft::num_complex::Complex32;
use rustfft::FftPlanner;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

const TAP_CAPACITY: usize = 8192;

/// Rolling buffer of recently-played mono samples, fed by the playback
/// thread and read by the (Tauri-command-thread) spectrum/waveform
/// analysis, so FFT work never happens on the realtime audio thread.
pub struct AudioTap {
    buffer: Mutex<VecDeque<f32>>,
}

impl AudioTap {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            buffer: Mutex::new(VecDeque::with_capacity(TAP_CAPACITY)),
        })
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

    pub fn is_silent(&self) -> bool {
        let Ok(buf) = self.buffer.lock() else {
            return true;
        };
        buf.is_empty() || buf.iter().all(|s| s.abs() < 1e-4)
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
        for b in bin0..bin1 {
            mag_sum += buffer[b].norm();
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
