use serde::{Deserialize, Serialize};

use super::AudioLabParams;
use crate::analyzer::StereoField;

/// Result of a one-shot "Audio optimization" pass over the real-time signal.
///
/// The `run_audio_optimization` command reads a few seconds from the loopback
/// tap, feeds it to [`optimize`], and applies the returned params immediately.
/// The diagnostics fields let the UI show *why* something changed (or why the
/// chain was left alone).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationResult {
    /// The parameters to apply: the current ones with adjustments folded in.
    pub params: AudioLabParams,
    /// Per-band EQ delta introduced by the flattening pass (0.0 = untouched).
    pub applied_eq: Vec<f32>,
    /// True when near-clipping forced the limiter on and trimmed the gain.
    pub clipping_protection: bool,
    /// True when the loudness curve was switched on for quiet material.
    pub loudness_enabled: bool,
    /// True when the compressor was switched on for dynamic material.
    pub compressor_enabled: bool,
    pub measured_lufs: f32,
    pub measured_peak: f32,
    pub notes: Vec<String>,
}

/// Hard ceiling for any EQ band after optimization, matching the UI's slider
/// range (−12..+12 dB).
const EQ_CEIL: f32 = 12.0;
/// Peak above which the chain is considered at risk of hard clipping.
const CLIP_PEAK: f32 = 0.92;
/// Crest factor (peak over RMS, in dB) above which the source counts as
/// "dynamic" and benefits from the compressor.
const DYNAMIC_CREST_DB: f32 = 14.0;
/// Loudness below which the loudness curve is nudged on.
const QUIET_LUFS: f32 = -28.0;
/// Bands that deviate less than this from the spectrum mean are left alone,
/// so a nearly-flat signal doesn't get jittered around.
const EQ_DEADBAND_DB: f32 = 0.5;
/// Maximum correction applied to a single band during flattening.
const EQ_CORRECTION_CEIL_DB: f32 = 6.0;

/// Derive a gentle corrective pass from a real measurement of the signal.
///
/// Pure and deterministic so it can be unit-tested: it never touches the
/// user's balance/stereo knobs, only folds safe adjustments into the EQ, gain,
/// limiter, compressor and loudness fields.
pub fn optimize(
    current: &AudioLabParams,
    levels_db: &[f32],
    field: &StereoField,
    peak: f32,
    rms: f32,
    lufs: f32,
) -> OptimizationResult {
    let mut params = current.clone();
    let mut notes: Vec<String> = Vec::new();
    let mut clipping_protection = false;
    let mut loudness_enabled = false;
    let mut compressor_enabled = false;

    let has_signal = peak > 1e-4;
    let measured = levels_db.len() == params.eq.len()
        && has_signal
        && levels_db.iter().any(|db| db.abs() > 1e-2);

    // 1) Spectral flattening — only against a real measurement, so a silent
    //    or still-starting tap doesn't zero the user's EQ.
    let mut applied_eq = vec![0.0; params.eq.len()];
    if measured {
        let mean = levels_db.iter().sum::<f32>() / levels_db.len() as f32;
        for (i, db) in levels_db.iter().enumerate() {
            let delta = (mean - db).clamp(-EQ_CORRECTION_CEIL_DB, EQ_CORRECTION_CEIL_DB);
            if delta.abs() >= EQ_DEADBAND_DB {
                let corrected = (params.eq[i] + delta).clamp(-EQ_CEIL, EQ_CEIL);
                applied_eq[i] = corrected - params.eq[i];
                params.eq[i] = corrected;
            }
        }
        notes.push("Espectro do sinal medido; curvas equilibradas por banda".into());
    }

    // 2) Clipping protection: pull the hottest sample back to about −1 dBFS
    //    (0.891) by trimming the post-EQ gain, and arm the limiter.
    if has_signal && peak > CLIP_PEAK {
        let delta_db = 20.0 * (0.891 / peak).log10();
        let gain_delta = delta_db.clamp(-6.0, 0.0);
        params.gain = (params.gain + gain_delta).clamp(-EQ_CEIL, EQ_CEIL);
        params.limiter = true;
        clipping_protection = true;
        notes.push(format!(
            "Pico a {:.0} dBFS: limiter ativo e ganho reduzido {:.1} dB",
            20.0 * peak.log10(),
            gain_delta.abs()
        ));
    }

    // 3) Compressor for dynamic material (high crest factor).
    let crest_db = if rms > 1e-6 { 20.0 * (peak / rms).log10() } else { 0.0 };
    if has_signal && crest_db > DYNAMIC_CREST_DB {
        params.compressor = true;
        compressor_enabled = true;
        notes.push(format!(
            "Material dinâmico (crest ~{:.0} dB): compressor ativo",
            crest_db
        ));
    }

    // 4) Loudness curve for quiet material.
    if has_signal && lufs < QUIET_LUFS {
        params.loudness = true;
        loudness_enabled = true;
        notes.push(format!("Áudio suave ({:.0} LUFS): loudness ativo", lufs));
    }

    // 5) Stereo sanity notes (no parameter change — those knobs are taste).
    if has_signal {
        if field.mono {
            notes.push("Fonte mono — balanço/largura estéreo não têm efeito".into());
        } else if field.correlation < 0.3 {
            notes.push(format!(
                "Correlação de fase baixa ({:.2}): risco de anulação em mono",
                field.correlation
            ));
        }
    }

    if notes.is_empty() {
        notes.push("Sinal equilibrado: sem ajustes necessários".into());
    }

    OptimizationResult {
        params,
        applied_eq,
        clipping_protection,
        loudness_enabled,
        compressor_enabled,
        measured_lufs: lufs,
        measured_peak: peak,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stereo() -> StereoField {
        StereoField {
            correlation: 1.0,
            balance: 0.0,
            width: 0.0,
            mono: false,
        }
    }

    #[test]
    fn flat_spectrum_leaves_eq_untouched() {
        let levels = vec![-20.0; 10];
        let result = optimize(&AudioLabParams::default(), &levels, &stereo(), 0.5, 0.2, -12.0);
        assert!(result.applied_eq.iter().all(|v| v.abs() < 1e-6));
        assert_eq!(result.params.eq, AudioLabParams::default().eq);
    }

    #[test]
    fn resonant_low_band_is_cut() {
        let mut levels = vec![-40.0; 10];
        levels[0] = -10.0; // 32 Hz ressonante: 30 dB acima da média
        let result = optimize(&AudioLabParams::default(), &levels, &stereo(), 0.5, 0.2, -12.0);
        assert!(result.applied_eq[0] < -0.5, "banda ressonante deve ser cortada");
        assert!(
            result.applied_eq[0] >= -6.0 && result.applied_eq[0] <= 0.0,
            "correção limitada a −6 dB"
        );
    }

    #[test]
    fn near_clipping_enables_limiter_and_trims_gain() {
        let levels = vec![-20.0; 10];
        let result = optimize(&AudioLabParams::default(), &levels, &stereo(), 0.99, 0.5, -6.0);
        assert!(result.clipping_protection);
        assert!(result.params.limiter);
        assert!(result.params.gain < 0.0, "ganho deve descer para dar headroom");
    }

    #[test]
    fn quiet_material_enables_loudness() {
        let levels = vec![-50.0; 10];
        let result = optimize(&AudioLabParams::default(), &levels, &stereo(), 0.05, 0.01, -50.0);
        assert!(result.loudness_enabled);
        assert!(result.params.loudness);
    }

    #[test]
    fn dynamic_material_enables_compressor_only() {
        let levels = vec![-20.0; 10];
        // crest = 20*log10(0.9/0.05) ≈ 25 dB, lufs ≈ −26.7 (> −28), peak 0.9 (< 0.92)
        let result = optimize(&AudioLabParams::default(), &levels, &stereo(), 0.9, 0.05, -26.0);
        assert!(result.compressor_enabled);
        assert!(result.params.compressor);
        assert!(!result.loudness_enabled, "material não é suave");
        assert!(!result.clipping_protection, "pico ainda não clipa");
    }

    #[test]
    fn silence_produces_no_adjustments() {
        let levels = vec![0.0; 10];
        let result = optimize(&AudioLabParams::default(), &levels, &stereo(), 0.0, 0.0, -70.0);
        assert!(result.applied_eq.iter().all(|v| v.abs() < 1e-6));
        assert!(!result.clipping_protection && !result.loudness_enabled && !result.compressor_enabled);
        assert_eq!(result.params.gain, 0.0);
    }
}
