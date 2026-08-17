use crate::platform::loopback::{convert_frames, read_loopback_format};
use std::time::{Duration, Instant};

use windows::Win32::Media::Audio::{
    eCapture, eConsole, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, IAudioCaptureClient,
    IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator, WAVEFORMATEX,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
};

/// One-shot microphone recording, used by Auto Calibration to measure the
/// room's response to the test signal played through `platform::playback`.
/// Unlike `platform::loopback` (which runs continuously for the realtime
/// analyzer), this opens the default capture endpoint, records for a fixed
/// duration and tears the stream back down.
fn ensure_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

fn open_capture_client() -> windows::core::Result<IAudioClient> {
    ensure_com();
    unsafe {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eCapture, eConsole)?;
        let client = device.Activate::<IAudioClient>(CLSCTX_ALL, None)?;

        let format: *mut WAVEFORMATEX = client.GetMixFormat()?;
        let result = client.Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 0, 0, format, None);
        if !format.is_null() {
            CoTaskMemFree(Some(format as *const _));
        }
        result?;
        Ok(client)
    }
}

/// Record `duration_ms` of audio from the default microphone, downmixed to
/// mono. Blocks the calling thread for roughly `duration_ms`. Returns an
/// error (instead of panicking) when there's no capture device available, so
/// the calibration command can fail gracefully with a clear message.
pub fn record_default_input(duration_ms: u32) -> Result<(Vec<f32>, u32), String> {
    let client = open_capture_client()
        .map_err(|e| format!("microfone indisponível: {e}"))?;
    let fmt = read_loopback_format(&client).map_err(|e| e.to_string())?;
    let capture = unsafe { client.GetService::<IAudioCaptureClient>() }.map_err(|e| e.to_string())?;
    unsafe { client.Start() }.map_err(|e| e.to_string())?;

    let deadline = Instant::now() + Duration::from_millis(duration_ms as u64);
    let mut mono: Vec<f32> = Vec::with_capacity(duration_ms as usize * 48);
    let mut scratch = Vec::with_capacity(8192);

    while Instant::now() < deadline {
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
                    for frame in scratch.chunks(fmt.channels) {
                        let m = frame.iter().sum::<f32>() / frame.len() as f32;
                        mono.push(m);
                    }
                }
            }
            let _ = unsafe { capture.ReleaseBuffer(frames) };
        }
    }

    let _ = unsafe { client.Stop() };

    if mono.is_empty() {
        return Err("nenhum áudio capturado pelo microfone — verifique se há um microfone padrão configurado no Windows".into());
    }
    Ok((mono, fmt.sample_rate))
}
