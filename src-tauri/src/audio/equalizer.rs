/// 10-band peaking equalizer using biquad filters.
///
/// This is a self-contained implementation (no external DSP crate) so the
/// hardware backend can eventually push per-band gains to the soundbar
/// instead of processing audio here.
#[derive(Clone, Copy, Debug)]
pub struct EqBand {
    pub frequency: f32,
    pub gain_db: f32,
    pub q: f32,
}

#[derive(Clone, Debug)]
pub struct Equalizer {
    pub bands: Vec<EqBand>,
    filters: Vec<Biquad>,
}

#[derive(Clone, Debug, Default)]
struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl Biquad {
    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

pub const BAND_FREQUENCIES: [f32; 10] = [
    32.0, 64.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];

impl Default for Equalizer {
    fn default() -> Self {
        let bands = BAND_FREQUENCIES
            .iter()
            .map(|&f| EqBand {
                frequency: f,
                gain_db: 0.0,
                q: 1.1,
            })
            .collect();
        let mut eq = Self {
            bands,
            filters: Vec::new(),
        };
        eq.rebuild_filters(48000);
        eq
    }
}

impl Equalizer {
    /// (Re)compute filter coefficients for every band. Call after changing any
    /// band gain or when the sample rate changes.
    pub fn rebuild_filters(&mut self, sample_rate: u32) {
        let sr = sample_rate as f32;
        self.filters = self
            .bands
            .iter()
            .map(|band| peaking_biquad(band, sr))
            .collect();
    }

    /// Set all band gains at once (dB, typically -12..+12).
    pub fn set_gains(&mut self, gains: &[f32], sample_rate: u32) {
        for (band, gain) in self.bands.iter_mut().zip(gains.iter()) {
            band.gain_db = gain.clamp(-12.0, 12.0);
        }
        self.rebuild_filters(sample_rate);
    }

    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let mut sample = input;
        for filter in self.filters.iter_mut() {
            sample = filter.process(sample);
        }
        sample
    }
}

/// Cookbook RBJ peaking filter coefficients.
fn peaking_biquad(band: &EqBand, sample_rate: f32) -> Biquad {
    let a = 10f32.powf(band.gain_db / 40.0);
    let w0 = std::f32::consts::TAU * (band.frequency / sample_rate);
    let alpha = w0.sin() / (2.0 * band.q);

    let cos_w0 = w0.cos();

    let b0 = 1.0 + alpha * a;
    let b1 = -2.0 * cos_w0;
    let b2 = 1.0 - alpha * a;
    let a0 = 1.0 + alpha / a;
    let a1 = -2.0 * cos_w0;
    let a2 = 1.0 - alpha / a;

    Biquad {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
        z1: 0.0,
        z2: 0.0,
    }
}
