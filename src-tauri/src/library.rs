use crate::music::Track;
use std::hash::{Hash, Hasher};
use std::path::Path;
use walkdir::WalkDir;

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma"];

/// Recursively scan every configured library folder for audio files and read
/// their tags. Files that fail to parse are skipped rather than aborting the
/// whole scan.
pub fn scan_folders(paths: &[String]) -> Vec<Track> {
    let mut tracks = Vec::new();
    for root in paths {
        if root.trim().is_empty() {
            continue;
        }
        for entry in WalkDir::new(root)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !AUDIO_EXTENSIONS.contains(&ext.as_str()) {
                continue;
            }
            if let Some(track) = read_track(path) {
                tracks.push(track);
            }
        }
    }
    tracks.sort_by(|a, b| a.artist.cmp(&b.artist).then(a.title.cmp(&b.title)));
    tracks
}

fn stable_id(path: &Path) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    format!("t{:x}", hasher.finish())
}

fn read_track(path: &Path) -> Option<Track> {
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::tag::Accessor;

    let file_stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Faixa desconhecida")
        .to_string();

    let tagged = lofty::read_from_path(path).ok();
    let (title, artist, album, duration_secs) = match &tagged {
        Some(tagged_file) => {
            let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
            let title = tag
                .and_then(|t| t.title())
                .map(|s| s.to_string())
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| file_stem.clone());
            let artist = tag
                .and_then(|t| t.artist())
                .map(|s| s.to_string())
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "Artista desconhecido".into());
            let album = tag
                .and_then(|t| t.album())
                .map(|s| s.to_string())
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "Álbum desconhecido".into());
            let duration_secs = tagged_file.properties().duration().as_secs_f32();
            (title, artist, album, duration_secs)
        }
        None => (
            file_stem.clone(),
            "Artista desconhecido".into(),
            "Álbum desconhecido".into(),
            0.0,
        ),
    };

    Some(Track {
        id: stable_id(path),
        title,
        artist,
        album,
        duration_secs,
        favorite: false,
        path: Some(path.to_string_lossy().to_string()),
    })
}

/// Public wrapper so the recognition "save to library" flow can turn a freshly
/// written WAV file into a `Track` using the exact same parsing/stable-id
/// logic a rescan would apply (so it matches across restarts).
pub fn track_from_path(path: &Path) -> Option<Track> {
    read_track(path)
}

/// Sanitize a user-provided name into something safe to use as a Windows file
/// name (invalid characters are replaced by `_`, the name is trimmed).
pub fn track_name_sanitized(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0'..='\x1f' => '_',
            c if c.is_whitespace() => '_',
            c => c,
        })
        .collect();
    let cleaned = cleaned.trim_matches('_').trim();
    if cleaned.is_empty() {
        "Reconhecimento".to_string()
    } else {
        cleaned.to_string()
    }
}

/// Write a mono clip as a 16-bit PCM WAV file. Kept dependency-free: the app
/// already ships a WAV decoder for scanning, but writing a raw PCM WAV only
/// needs a small hand-rolled RIFF header.
pub fn write_wav_file(path: &Path, samples: &[f32], sample_rate: u32) -> Result<(), String> {
    use std::io::Write;

    let data_len = samples.len() * 2;
    let byte_rate = sample_rate * 2;

    let mut file = std::fs::File::create(path)
        .map_err(|e| format!("falha ao criar o ficheiro de áudio: {e}"))?;

    let write_u32 = |file: &mut std::fs::File, v: u32| {
        file.write_all(&v.to_le_bytes()).map_err(|e| e.to_string())
    };
    let write_u16 = |file: &mut std::fs::File, v: u16| {
        file.write_all(&v.to_le_bytes()).map_err(|e| e.to_string())
    };

    write_all(&mut file, b"RIFF")?;
    write_u32(&mut file, 36 + data_len as u32)?;
    write_all(&mut file, b"WAVE")?;
    write_all(&mut file, b"fmt ")?;
    write_u32(&mut file, 16)?;
    write_u16(&mut file, 1)?; // PCM
    write_u16(&mut file, 1)?; // mono
    write_u32(&mut file, sample_rate)?;
    write_u32(&mut file, byte_rate)?;
    write_u16(&mut file, 2)?; // block align
    write_u16(&mut file, 16)?; // bits per sample
    write_all(&mut file, b"data")?;
    write_u32(&mut file, data_len as u32)?;

    let mut scratch = Vec::with_capacity(1024 * 2);
    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let value = (clamped * 32767.0).round().clamp(-32768.0, 32767.0) as i16;
        scratch.extend_from_slice(&value.to_le_bytes());
        if scratch.len() >= 1024 * 2 {
            write_all(&mut file, &scratch)?;
            scratch.clear();
        }
    }
    if !scratch.is_empty() {
        write_all(&mut file, &scratch)?;
    }

    Ok(())
}

fn write_all(file: &mut std::fs::File, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    file.write_all(bytes).map_err(|e| format!("falha ao escrever o ficheiro de áudio: {e}"))
}

/// Extract the embedded album art of an audio file as a `data:` URL, so the
/// frontend can render a real cover without reading any file directly.
/// Returns `None` when the file has no picture (the UI falls back to a
/// gradient tile).
pub fn read_track_art(path: &Path) -> Option<String> {
    use base64::Engine as _;
    use lofty::file::TaggedFileExt;

    let tagged = lofty::read_from_path(path).ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let picture = tag.pictures().first()?;
    let mime = picture
        .mime_type()
        .map(|m| m.to_string())
        .unwrap_or_else(|| "image/jpeg".into());
    Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(picture.data())
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn sanitize_replaces_invalid_windows_chars() {
        assert_eq!(track_name_sanitized("a<b:c>d/e|f?g*h"), "a_b_c_d_e_f_g_h");
        assert_eq!(track_name_sanitized("  música  "), "música");
        assert_eq!(track_name_sanitized("???"), "Reconhecimento");
        assert_eq!(track_name_sanitized(""), "Reconhecimento");
    }

    #[test]
    fn write_wav_creates_valid_pcm16_header() {
        let dir = std::env::temp_dir().join("soundcore-wav-test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("clip.wav");
        let _ = std::fs::remove_file(&path);

        let samples = vec![0.0, 0.5, -0.5, 1.0];
        write_wav_file(&path, &samples, 44_100).unwrap();

        let mut bytes = Vec::new();
        std::fs::File::open(&path).unwrap().read_to_end(&mut bytes).unwrap();

        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
        assert_eq!(&bytes[12..16], b"fmt ");
        assert_eq!(u16::from_le_bytes([bytes[20], bytes[21]]), 1); // PCM
        assert_eq!(u16::from_le_bytes([bytes[22], bytes[23]]), 1); // mono
        assert_eq!(u32::from_le_bytes(bytes[24..28].try_into().unwrap()), 44_100);
        assert_eq!(u32::from_le_bytes(bytes[28..32].try_into().unwrap()), 88_200);
        assert_eq!(u16::from_le_bytes([bytes[34], bytes[35]]), 16); // bits
        assert_eq!(&bytes[36..40], b"data");
        assert_eq!(u32::from_le_bytes(bytes[40..44].try_into().unwrap()), 8);
        assert_eq!(bytes.len(), 44 + 8);

        let read_i16 = |i: usize| i16::from_le_bytes([bytes[44 + i * 2], bytes[45 + i * 2]]);
        assert_eq!(read_i16(0), 0);
        assert_eq!(read_i16(1), 16_384); // 0.5 * 32767 rounded
        assert_eq!(read_i16(2), -16_384);
        assert_eq!(read_i16(3), 32_767);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn track_from_path_reads_written_wav() {
        let dir = std::env::temp_dir().join("soundcore-wav-track-test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("Minha_Gravação.wav");
        let _ = std::fs::remove_file(&path);

        write_wav_file(&path, &[0.0; 100], 8_000).unwrap();
        let track = track_from_path(&path).expect("wav should parse");
        assert_eq!(track.title, "Minha_Gravação");
        assert!(track.path.is_some());
        assert_eq!(track.duration_secs, 0.013);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
