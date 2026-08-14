use crate::audio::{AudioLabParams, DspEngine};
use cpal::traits::{DeviceTrait, HostTrait};
use rodio::{ChannelCount, DeviceSinkBuilder, MixerDeviceSink, Player, SampleRate, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Live Audio Lab parameters shared between the UI-facing Tauri commands and
/// the realtime playback thread. The playback thread only ever polls
/// `version` (a cheap atomic load) and `try_lock`s the params when it
/// changes, so a slow/contended UI thread can never stall audio.
pub struct SharedDsp {
    params: Mutex<AudioLabParams>,
    version: AtomicU64,
}

impl SharedDsp {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            params: Mutex::new(AudioLabParams::default()),
            version: AtomicU64::new(1),
        })
    }

    pub fn set(&self, params: AudioLabParams) {
        if let Ok(mut guard) = self.params.lock() {
            *guard = params;
        }
        self.version.fetch_add(1, Ordering::Relaxed);
    }

    pub fn update(&self, f: impl FnOnce(&mut AudioLabParams)) {
        if let Ok(mut guard) = self.params.lock() {
            f(&mut guard);
        }
        self.version.fetch_add(1, Ordering::Relaxed);
    }
}

/// How many samples to let pass between checks of `SharedDsp::version`. At
/// 48kHz stereo this is roughly a 20ms cadence — fast enough to feel live,
/// coarse enough that the atomic load is free.
const POLL_INTERVAL_SAMPLES: u32 = 2048;

/// Wraps a decoded audio source and runs every sample through the app's EQ /
/// compressor / limiter chain, one independent `DspEngine` per channel so
/// stereo filter state never bleeds across L/R.
struct DspSource<S> {
    inner: S,
    engines: Vec<DspEngine>,
    channel: usize,
    shared: Arc<SharedDsp>,
    seen_version: u64,
    since_poll: u32,
}

impl<S> DspSource<S>
where
    S: Source,
{
    fn new(inner: S, shared: Arc<SharedDsp>) -> Self {
        let channels = inner.channels().get().max(1) as usize;
        let sample_rate = inner.sample_rate().get();
        let mut engines: Vec<DspEngine> = (0..channels).map(|_| DspEngine::new(sample_rate)).collect();
        let params = shared.params.lock().map(|p| p.clone()).unwrap_or_default();
        for engine in engines.iter_mut() {
            engine.apply_params(params.clone());
        }
        Self {
            inner,
            engines,
            channel: 0,
            shared,
            seen_version: 0,
            since_poll: 0,
        }
    }

    fn maybe_refresh_params(&mut self) {
        self.since_poll += 1;
        if self.since_poll < POLL_INTERVAL_SAMPLES {
            return;
        }
        self.since_poll = 0;
        let version = self.shared.version.load(Ordering::Relaxed);
        if version == self.seen_version {
            return;
        }
        if let Ok(params) = self.shared.params.try_lock() {
            let params = params.clone();
            for engine in self.engines.iter_mut() {
                engine.apply_params(params.clone());
            }
            self.seen_version = version;
        }
    }
}

impl<S> Iterator for DspSource<S>
where
    S: Source,
{
    type Item = rodio::Sample;

    fn next(&mut self) -> Option<Self::Item> {
        self.maybe_refresh_params();
        let sample = self.inner.next()?;
        let n = self.engines.len();
        let processed = self.engines[self.channel % n].process_frame(sample);
        self.channel = (self.channel + 1) % n;
        Some(processed)
    }
}

impl<S> Source for DspSource<S>
where
    S: Source,
{
    fn current_span_len(&self) -> Option<usize> {
        self.inner.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.inner.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
}

/// Open a `cpal` output device by friendly name (matching a WASAPI endpoint
/// name from `platform::wasapi`), falling back to the system default output
/// when no match is found or none was requested.
fn open_device(preferred_name: Option<&str>) -> Result<MixerDeviceSink, String> {
    if let Some(name) = preferred_name {
        if let Ok(devices) = cpal::default_host().output_devices() {
            for device in devices {
                let matches = device
                    .description()
                    .map(|d| d.name() == name)
                    .unwrap_or(false);
                if matches {
                    return DeviceSinkBuilder::from_device(device)
                        .map_err(|e| e.to_string())?
                        .open_stream()
                        .map_err(|e| e.to_string());
                }
            }
        }
    }
    DeviceSinkBuilder::open_default_sink().map_err(|e| e.to_string())
}

/// Owns the real output device + player for local file playback.
pub struct PlaybackEngine {
    device: Option<MixerDeviceSink>,
    player: Option<Player>,
}

impl PlaybackEngine {
    pub fn new() -> Self {
        Self {
            device: None,
            player: None,
        }
    }

    /// Decode `path` and start playing it immediately through the DSP chain
    /// on `device_name` (or the system default output), replacing whatever
    /// was playing before.
    pub fn play_file(&mut self, path: &str, dsp: Arc<SharedDsp>, device_name: Option<&str>) -> Result<(), String> {
        let file = File::open(path).map_err(|e| format!("failed to open '{path}': {e}"))?;
        let decoder =
            rodio::Decoder::new(BufReader::new(file)).map_err(|e| format!("failed to decode '{path}': {e}"))?;
        let source = DspSource::new(decoder, dsp);

        let device = open_device(device_name)?;
        let player = Player::connect_new(device.mixer());
        player.append(source);
        player.play();

        self.device = Some(device);
        self.player = Some(player);
        Ok(())
    }

    pub fn pause(&self) {
        if let Some(p) = &self.player {
            p.pause();
        }
    }

    pub fn resume(&self) {
        if let Some(p) = &self.player {
            p.play();
        }
    }

    #[allow(dead_code)]
    pub fn is_paused(&self) -> bool {
        self.player.as_ref().map(|p| p.is_paused()).unwrap_or(true)
    }

    #[allow(dead_code)]
    pub fn stop(&mut self) {
        if let Some(p) = self.player.take() {
            p.stop();
        }
        self.device = None;
    }

    /// True once the current track has fully played out (or nothing is
    /// loaded). Used to auto-advance the queue.
    pub fn finished(&self) -> bool {
        self.player.as_ref().map(|p| p.empty()).unwrap_or(true)
    }

    pub fn position_secs(&self) -> f32 {
        self.player.as_ref().map(|p| p.get_pos().as_secs_f32()).unwrap_or(0.0)
    }
}

impl Default for PlaybackEngine {
    fn default() -> Self {
        Self::new()
    }
}
