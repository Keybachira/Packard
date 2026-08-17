//! Local, offline music recognition: record a clip from the microphone,
//! turn it into a landmark-hash fingerprint (the same core technique
//! Shazam popularized — a "constellation map" of spectral peaks, hashed in
//! pairs with their time delta), and match it against fingerprints of the
//! user's own scanned library.
//!
//! This intentionally does **not** call out to an external
//! identification service — there's no database of the world's music here,
//! so it can only ever recognize a track already in the user's library
//! (useful for "what's this song I already have playing nearby" style
//! recognition). Wiring a real Shazam/AcoustID-style external lookup would
//! need an API key and a decision about which service to use.

use rustfft::num_complex::Complex32;
use rustfft::FftPlanner;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;

const WINDOW: usize = 4096;
const HOP: usize = 2048;
/// Strongest spectral peaks kept per analysis frame.
const PEAKS_PER_FRAME: usize = 5;
/// How many later frames each peak gets paired with when building hashes.
const FAN_OUT: usize = 5;
/// Peaks above this are ignored — most of what survives a laptop/phone mic
/// recording of music lives below here, and cutting the top end makes the
/// fingerprint less sensitive to mic frequency response differences.
const MAX_FREQ_HZ: f32 = 5000.0;
/// Minimum fraction of the query's hashes that must agree on the same time
/// offset for a candidate to count as a match, rather than coincidental
/// hash collisions.
const MATCH_THRESHOLD: f32 = 0.12;

/// A fingerprint: `(hash, anchor_frame)` pairs. `hash` packs
/// `(freq_bin_a, freq_bin_b, delta_frames)` into a single u32.
pub type Fingerprint = Vec<(u32, u32)>;

/// Build a landmark-hash fingerprint from mono audio. FFTs the signal in
/// overlapping windows, keeps each window's strongest peaks, then hashes
/// every (peak, later peak) pair within `FAN_OUT` frames. Matching by
/// *shared hashes with a consistent time offset* (see `best_match`) is what
/// makes this robust to noise around the real signal, unlike comparing raw
/// spectra directly.
pub fn fingerprint(samples: &[f32], sample_rate: u32) -> Fingerprint {
    if samples.len() < WINDOW || sample_rate == 0 {
        return Vec::new();
    }

    let half = WINDOW / 2;
    let nyquist = (sample_rate as f32 / 2.0).max(1.0);
    let max_bin = (((MAX_FREQ_HZ.min(nyquist)) / nyquist) * half as f32) as usize;
    let max_bin = max_bin.clamp(1, half.saturating_sub(1));

    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(WINDOW);

    let mut peaks_per_frame: Vec<Vec<u32>> = Vec::new();
    let mut offset = 0;
    while offset + WINDOW <= samples.len() {
        let chunk = &samples[offset..offset + WINDOW];
        let mut buffer: Vec<Complex32> = chunk
            .iter()
            .enumerate()
            .map(|(i, &s)| {
                let w = 0.5
                    - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (WINDOW - 1) as f32).cos();
                Complex32::new(s * w, 0.0)
            })
            .collect();
        fft.process(&mut buffer);

        let mut mags: Vec<(usize, f32)> = buffer[..max_bin]
            .iter()
            .enumerate()
            .map(|(bin, c)| (bin, c.norm()))
            .collect();
        mags.sort_by(|a, b| b.1.total_cmp(&a.1));
        let peaks = mags.iter().take(PEAKS_PER_FRAME).map(|&(bin, _)| bin as u32).collect();
        peaks_per_frame.push(peaks);

        offset += HOP;
    }

    let mut hashes = Vec::new();
    for (t, peaks) in peaks_per_frame.iter().enumerate() {
        for &f1 in peaks {
            for dt in 1..=FAN_OUT {
                let Some(future) = peaks_per_frame.get(t + dt) else {
                    break;
                };
                for &f2 in future {
                    let hash = ((f1 & 0x3FF) << 18) | ((f2 & 0x3FF) << 8) | (dt as u32 & 0xFF);
                    hashes.push((hash, t as u32));
                }
            }
        }
    }
    hashes
}

/// Find the best-matching candidate for `query` among `candidates`. Scores
/// each candidate by the size of its largest time-offset cluster of shared
/// hashes — a real match has many hashes agreeing on the *same* relative
/// offset, which coincidental hash collisions almost never do. Returns
/// `(id, confidence 0..1)` for the best candidate, even below
/// `MATCH_THRESHOLD` — callers decide whether the score counts as a match.
pub fn best_match<'a, I>(query: &Fingerprint, candidates: I) -> Option<(String, f32)>
where
    I: IntoIterator<Item = (&'a str, &'a Fingerprint)>,
{
    if query.is_empty() {
        return None;
    }

    let mut best: Option<(String, f32)> = None;
    for (id, candidate) in candidates {
        if candidate.is_empty() {
            continue;
        }
        let mut index: HashMap<u32, Vec<u32>> = HashMap::new();
        for &(hash, anchor) in candidate {
            index.entry(hash).or_default().push(anchor);
        }

        let mut offsets: HashMap<i64, u32> = HashMap::new();
        for &(hash, q_anchor) in query {
            if let Some(anchors) = index.get(&hash) {
                for &c_anchor in anchors {
                    let offset = c_anchor as i64 - q_anchor as i64;
                    *offsets.entry(offset).or_insert(0) += 1;
                }
            }
        }

        let top = offsets.values().copied().max().unwrap_or(0);
        let score = top as f32 / query.len() as f32;
        if best.as_ref().map(|(_, s)| score > *s).unwrap_or(true) {
            best = Some((id.to_string(), score));
        }
    }
    best
}

/// True when `score` (from `best_match`) is strong enough to call it a
/// match rather than noise.
pub fn is_confident(score: f32) -> bool {
    score >= MATCH_THRESHOLD
}

/// Decode up to `max_seconds` of `path` into mono f32 samples, for
/// fingerprinting a library track. Never panics on a malformed file —
/// mirrors the guard in `playback::PlaybackEngine::play_file`.
pub fn decode_mono_prefix(path: &str, max_seconds: f32) -> Result<(Vec<f32>, u32), String> {
    use rodio::Source;

    let file = std::fs::File::open(path).map_err(|e| format!("failed to open '{path}': {e}"))?;
    let decoder = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        rodio::Decoder::new(std::io::BufReader::new(file))
    }))
    .map_err(|_| format!("failed to decode '{path}': malformed or unsupported audio"))?
    .map_err(|e| format!("failed to decode '{path}': {e}"))?;

    let channels = decoder.channels().get().max(1) as usize;
    let sample_rate = decoder.sample_rate().get();
    let max_frames = (sample_rate as f32 * max_seconds) as usize;

    let mut mono = Vec::with_capacity(max_frames.min(sample_rate as usize * 30));
    let mut frame_buf: Vec<f32> = Vec::with_capacity(channels);
    for s in decoder {
        if mono.len() >= max_frames {
            break;
        }
        frame_buf.push(s);
        if frame_buf.len() == channels {
            let m = frame_buf.iter().sum::<f32>() / channels as f32;
            mono.push(m);
            frame_buf.clear();
        }
    }
    Ok((mono, sample_rate))
}

/// One past recognition attempt, most recent first in storage.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionEntry {
    pub id: String,
    pub timestamp_ms: u64,
    pub matched_track_id: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub confidence: f32,
}

/// Recognition history persisted to `app_config_dir/recognition.json`,
/// following the same load/save shape as `music_store::MusicPersist`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RecognitionPersist {
    pub history: Vec<RecognitionEntry>,
}

impl RecognitionPersist {
    fn path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("failed to resolve config dir: {e}"))?;
        std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create config dir: {e}"))?;
        Ok(dir.join("recognition.json"))
    }

    pub fn load(app: &tauri::AppHandle) -> Self {
        let path = match Self::path(app) {
            Ok(p) => p,
            Err(_) => return Self::default(),
        };
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, app: &tauri::AppHandle) -> Result<(), String> {
        let path = Self::path(app)?;
        let raw = serde_json::to_string_pretty(self).map_err(|e| format!("serialize: {e}"))?;
        std::fs::write(path, raw).map_err(|e| format!("write recognition state: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone_mix(freqs: &[f32], sample_rate: u32, seconds: f32) -> Vec<f32> {
        let n = (sample_rate as f32 * seconds) as usize;
        (0..n)
            .map(|i| {
                let t = i as f32 / sample_rate as f32;
                freqs.iter().map(|&f| (2.0 * std::f32::consts::PI * f * t).sin()).sum::<f32>()
                    / freqs.len() as f32
            })
            .collect()
    }

    #[test]
    fn short_input_yields_empty_fingerprint() {
        assert!(fingerprint(&[0.0; 100], 44_100).is_empty());
    }

    #[test]
    fn empty_query_has_no_match() {
        let fp_a: Fingerprint = vec![(1, 1)];
        let candidates = vec![("a", &fp_a)];
        assert!(best_match(&Vec::new(), candidates).is_none());
    }

    #[test]
    fn matches_a_noisy_clip_of_the_right_track_over_decoys() {
        let sr = 22_050;
        let track_a = tone_mix(&[440.0, 880.0, 1200.0], sr, 6.0);
        let track_b = tone_mix(&[300.0, 650.0, 2000.0], sr, 6.0);
        let track_c = tone_mix(&[900.0, 1500.0, 3000.0], sr, 6.0);

        // Query: a short excerpt from partway through track_a, with a bit
        // of synthetic "microphone" noise mixed in.
        let start = 2 * sr as usize;
        let mut query: Vec<f32> = track_a[start..start + 2 * sr as usize].to_vec();
        for (i, s) in query.iter_mut().enumerate() {
            *s += 0.05 * (i as f32 * 0.37).sin();
        }

        let fp_query = fingerprint(&query, sr);
        let fp_a = fingerprint(&track_a, sr);
        let fp_b = fingerprint(&track_b, sr);
        let fp_c = fingerprint(&track_c, sr);

        let candidates = vec![("a", &fp_a), ("b", &fp_b), ("c", &fp_c)];
        let (best_id, score) = best_match(&fp_query, candidates).expect("should match something");
        assert_eq!(best_id, "a");
        assert!(is_confident(score), "confidence too low: {score}");
    }
}
