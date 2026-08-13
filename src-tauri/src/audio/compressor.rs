/// Simple feed-forward compressor with an envelope follower.
/// Unused until the WASAPI capture loop is wired; kept for the DSP chain.
#[allow(dead_code)]
#[derive(Clone, Copy, Debug)]
pub struct Compressor {
    pub threshold_db: f32,
    pub ratio: f32,
    pub attack_ms: f32,
    pub release_ms: f32,
    /// Makeup gain applied after compression (dB).
    pub makeup_db: f32,
    pub enabled: bool,
    envelope: f32,
}

impl Default for Compressor {
    fn default() -> Self {
        Self {
            threshold_db: -18.0,
            ratio: 4.0,
            attack_ms: 10.0,
            release_ms: 120.0,
            makeup_db: 0.0,
            enabled: false,
            envelope: 0.0,
        }
    }
}

impl Compressor {
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        if !self.enabled {
            return input;
        }

        // Envelope follower (peak, smoothed). Envelope time constant converted
        // to a coefficient assuming a 48kHz sample rate.
        let sr = 48_000.0;
        let attack_coef = time_constant(self.attack_ms, sr, 0.0);
        let release_coef = time_constant(self.release_ms, sr, 1.0);

        let abs = input.abs();
        let coef = if abs > self.envelope { attack_coef } else { release_coef };
        self.envelope = coef * self.envelope + (1.0 - coef) * abs;

        let env_db = 20.0 * self.envelope.log10().max(-120.0);
        let over = (env_db - self.threshold_db).max(0.0);
        let gain_db = -(over * (1.0 - 1.0 / self.ratio));
        let gain = 10f32.powf((gain_db + self.makeup_db) / 20.0);

        input * gain
    }
}

/// One-pole smoothing coefficient for a time constant in ms.
fn time_constant(ms: f32, sr: f32, mode: f32) -> f32 {
    let tau = ms / 1000.0 * sr;
    if tau <= 0.0 {
        return 0.0;
    }
    (-1.0 / (tau * (1.0 + mode))).exp()
}
