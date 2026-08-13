/// Look-ahead brickwall limiter using a smoothed gain reduction.
/// Unused until the WASAPI capture loop is wired; kept for the DSP chain.
#[allow(dead_code)]
#[derive(Clone, Copy, Debug)]
pub struct Limiter {
    pub ceiling_db: f32,
    pub release_ms: f32,
    pub enabled: bool,
    gain: f32,
}

impl Default for Limiter {
    fn default() -> Self {
        Self {
            ceiling_db: -1.0,
            release_ms: 80.0,
            enabled: true,
            gain: 1.0,
        }
    }
}

impl Limiter {
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        if !self.enabled {
            return input;
        }

        let ceiling = 10f32.powf(self.ceiling_db / 20.0);
        let level = input.abs();

        if level > ceiling {
            self.gain = ceiling / level.max(1e-9);
        } else {
            // Release back toward unity.
            let sr = 48_000.0;
            let tau = (self.release_ms / 1000.0) * sr;
            let coef = if tau > 0.0 { (-1.0 / tau).exp() } else { 0.0 };
            self.gain = 1.0 + (self.gain - 1.0) * coef;
        }

        (input * self.gain).clamp(-1.0, 1.0)
    }
}