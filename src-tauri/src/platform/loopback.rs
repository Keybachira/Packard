use crate::analyzer::AudioTap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use windows::Win32::Media::Audio::{
    eConsole, eRender, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator,
    MMDeviceEnumerator, WAVEFORMATEX, WAVEFORMATEXTENSIBLE,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
};

/// WAVEFORMATEX format tags. Defined locally instead of pulling in the
/// `Win32_Media_Multimedia` / `Win32_Media_KernelStreaming` feature gates.
const WAVE_FORMAT_IEEE_FLOAT: u16 = 0x0003;
const WAVE_FORMAT_EXTENSIBLE: u16 = 0xFFFE;

/// KSDATAFORMAT_SUBTYPE_* GUIDs (MediaTypes.h).
const SUBTYPE_PCM: windows::core::GUID =
    windows::core::GUID::from_u128(0x0000_0001_0000_0010_8000_00aa_0038_9b71);
const SUBTYPE_IEEE_FLOAT: windows::core::GUID =
    windows::core::GUID::from_u128(0x0000_0003_0000_0010_8000_00aa_0038_9b71);

/// Keeps a WASAPI loopback capture thread running for the app's lifetime,
/// feeding a shared `AudioTap` so the realtime analyzer reflects whatever the
/// user is actually hearing (their own playback, browser, etc.).
pub struct LoopbackCapture {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
    last_error: Arc<Mutex<Option<String>>>,
}

impl LoopbackCapture {
    /// Spawn the capture thread. On any setup failure the thread records the
    /// error (`last_error`) and idles, so the analyzer simply reports silence.
    pub fn start(tap: Arc<AudioTap>) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let stop_flag = stop.clone();
        let last_error = Arc::new(Mutex::new(None));
        let err_flag = last_error.clone();
        let handle = thread::spawn(move || capture_loop(tap, stop_flag, err_flag));
        Self {
            stop,
            handle: Some(handle),
            last_error,
        }
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }

    /// Last capture failure message, if any (diagnostics).
    pub fn last_error(&self) -> Option<String> {
        self.last_error.lock().ok().and_then(|g| g.clone())
    }
}

impl Drop for LoopbackCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

fn ensure_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

/// Open the default render endpoint in shared-mode loopback, so we capture
/// exactly what is being played to the default output device.
fn open_loopback_client() -> windows::core::Result<IAudioClient> {
    ensure_com();
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let client = device.Activate::<IAudioClient>(CLSCTX_ALL, None)?;

        let format: *mut WAVEFORMATEX = client.GetMixFormat()?;
        let result = client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            0,
            0,
            format,
            None,
        );
        if !format.is_null() {
            CoTaskMemFree(Some(format as *const _));
        }
        result?;
        Ok(client)
    }
}

/// How the captured stream is packed, derived from the mix format.
struct LoopbackFormat {
    channels: usize,
    /// Bytes per single (mono) sample.
    bytes_per_sample: usize,
    /// Bytes per interleaved frame.
    block_align: usize,
    bits: u16,
    is_float: bool,
    sample_rate: u32,
}

fn read_loopback_format(client: &IAudioClient) -> windows::core::Result<LoopbackFormat> {
    let format: *mut WAVEFORMATEX = unsafe { client.GetMixFormat()? };
    if format.is_null() {
        return Err(windows::core::Error::empty());
    }

    let ex = unsafe { &*format };
    let channels = ex.nChannels as usize;
    let block_align = ex.nBlockAlign as usize;
    let sample_rate = ex.nSamplesPerSec;
    let mut bits = ex.wBitsPerSample;
    let mut is_float = ex.wFormatTag == WAVE_FORMAT_IEEE_FLOAT;

    if ex.wFormatTag == WAVE_FORMAT_EXTENSIBLE
        && ex.cbSize as usize
            >= std::mem::size_of::<WAVEFORMATEXTENSIBLE>() - std::mem::size_of::<WAVEFORMATEX>()
    {
        let ext = unsafe { &*(format as *const WAVEFORMATEXTENSIBLE) };
        // Copy out of the packed struct to avoid unaligned references.
        let sub = ext.SubFormat;
        if sub == SUBTYPE_IEEE_FLOAT {
            is_float = true;
        }
        if sub == SUBTYPE_PCM {
            is_float = false;
        }
        let valid = unsafe { ext.Samples.wValidBitsPerSample };
        if valid != 0 {
            bits = valid;
        }
    }

    let bytes_per_sample = if is_float { 4 } else { (bits as usize).div_ceil(8) };
    if channels == 0 || block_align == 0 || bytes_per_sample == 0 {
        unsafe { CoTaskMemFree(Some(format as *const _)) };
        return Err(windows::core::Error::empty());
    }

    unsafe { CoTaskMemFree(Some(format as *const _)) };
    Ok(LoopbackFormat {
        channels,
        bytes_per_sample,
        block_align,
        bits,
        is_float,
        sample_rate,
    })
}

/// Decode an interleaved PCM buffer into `f32` samples.
fn convert_frames(data: *const u8, frames: usize, fmt: &LoopbackFormat) -> Vec<f32> {
    let mut out = Vec::with_capacity(frames * fmt.channels);
    for frame in 0..frames {
        let base = unsafe { data.add(frame * fmt.block_align) };
        for ch in 0..fmt.channels {
            let p = unsafe { base.add(ch * fmt.bytes_per_sample) };
            let sample = if fmt.is_float {
                unsafe { *p.cast::<f32>() }
            } else {
                match fmt.bits {
                    16 => (unsafe { *p.cast::<i16>() }) as f32 / 32_768.0,
                    24 => {
                        let raw = unsafe { *(p as *const [u8; 3]) };
                        let mut v =
                            (raw[0] as i32) | ((raw[1] as i32) << 8) | ((raw[2] as i32) << 16);
                        if raw[2] & 0x80 != 0 {
                            v |= !0xFF_FFFF;
                        }
                        v as f32 / 8_388_608.0
                    }
                    32 => (unsafe { *p.cast::<i32>() }) as f32 / 2_147_483_648.0,
                    _ => 0.0,
                }
            };
            out.push(sample);
        }
    }
    out
}

fn capture_loop(tap: Arc<AudioTap>, stop: Arc<AtomicBool>, err_flag: Arc<Mutex<Option<String>>>) {
    let fail = |e: windows::core::Error| {
        eprintln!("[loopback] capture unavailable: {e}");
        if let Ok(mut g) = err_flag.lock() {
            *g = Some(format!("{e}"));
        }
    };

    let client = match open_loopback_client() {
        Ok(c) => c,
        Err(e) => {
            fail(e);
            return;
        }
    };
    let fmt = match read_loopback_format(&client) {
        Ok(f) => f,
        Err(e) => {
            fail(e);
            return;
        }
    };
    tap.set_sample_rate(fmt.sample_rate);
    let capture = match unsafe { client.GetService::<IAudioCaptureClient>() } {
        Ok(c) => c,
        Err(e) => {
            fail(e);
            return;
        }
    };
    if let Err(e) = unsafe { client.Start() } {
        fail(e);
        return;
    }
    if let Ok(mut g) = err_flag.lock() {
        *g = None;
    }

    let mut scratch = Vec::with_capacity(8192);
    while !stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(15));
        loop {
            let Ok(next) = (unsafe { capture.GetNextPacketSize() }) else {
                break;
            };
            if next == 0 {
                break;
            }
            let mut data: *mut u8 = std::ptr::null_mut();
            let mut frames: u32 = 0;
            let mut flags: u32 = 0;
            if (unsafe { capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None) }).is_err() {
                break;
            }
            if frames > 0 && !data.is_null() {
                let silent = flags & (AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) != 0;
                if !silent {
                    scratch.clear();
                    scratch.extend(convert_frames(data, frames as usize, &fmt));
                    tap.push(&scratch, fmt.channels);
                }
            }
            if (unsafe { capture.ReleaseBuffer(frames) }).is_err() {
                break;
            }
        }
    }

    let _ = unsafe { client.Stop() };
}
