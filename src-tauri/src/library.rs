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
