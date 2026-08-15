import type { Playlist, Track } from "../../types/audio";

export interface ArtistGroup {
  id: string;
  name: string;
  trackIds: string[];
}

export interface AlbumGroup {
  id: string;
  name: string;
  artist: string;
  trackIds: string[];
}

export interface FolderGroup {
  id: string;
  name: string;
  path: string;
  trackIds: string[];
}

export function groupArtists(tracks: Track[]): ArtistGroup[] {
  const map = new Map<string, ArtistGroup>();
  for (const t of tracks) {
    const key = t.artist || "Unknown";
    const g = map.get(key);
    if (g) {
      g.trackIds.push(t.id);
    } else {
      map.set(key, { id: key, name: key, trackIds: [t.id] });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function groupAlbums(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const t of tracks) {
    const key = `${t.album ?? "Unknown"}::${t.artist ?? ""}`.toLowerCase();
    const g = map.get(key);
    if (g) {
      g.trackIds.push(t.id);
    } else {
      map.set(key, {
        id: key,
        name: t.album ?? "Unknown",
        artist: t.artist ?? "",
        trackIds: [t.id],
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

function folderOf(path: string | null): { name: string; path: string } | null {
  if (!path) return null;
  let norm = path.replace(/\\/g, "/").trim().replace(/\/+$/, "");
  if (!norm) return null;

  const idx = norm.lastIndexOf("/");
  // No directory separator: a bare filename (or drive root) with no parent
  // folder. Group it under a virtual root so it still shows up.
  if (idx <= 0) {
    return { name: "Biblioteca", path: "<root>" };
  }

  const dir = norm.slice(0, idx);
  const seg = dir.lastIndexOf("/");
  const name = seg >= 0 ? dir.slice(seg + 1) : dir;
  return { name: name || dir, path: dir };
}

export function groupFolders(tracks: Track[]): FolderGroup[] {
  const map = new Map<string, FolderGroup>();
  for (const t of tracks) {
    const f = folderOf(t.path);
    if (!f) continue;
    // Dedupe case-insensitively (Windows/macOS paths), keep first-seen name.
    const key = f.path.toLowerCase();
    const g = map.get(key);
    if (g) {
      g.trackIds.push(t.id);
    } else {
      map.set(key, {
        id: f.path,
        name: f.name,
        path: f.path,
        trackIds: [t.id],
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function resolvePlaylist(
  playlists: Playlist[],
  library: Track[],
  playlistId: string,
): Track[] {
  const pl = playlists.find((p) => p.id === playlistId);
  if (!pl) return [];
  return pl.trackIds
    .map((id) => library.find((t) => t.id === id))
    .filter((t): t is Track => Boolean(t));
}

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `linear-gradient(140deg, hsl(${hue} 60% 38%), hsl(${(hue + 60) % 360} 55% 24%))`;
}