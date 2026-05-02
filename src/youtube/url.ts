// Strip share-tracking and other non-canonical params, keep only the bits
// that identify the resource: `v` for videos, `list` for playlists.
// Also normalize Shorts and youtu.be to canonical forms.

const KEEP_PARAMS = new Set(["v", "list"]);

export function stripShareTracking(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (!KEEP_PARAMS.has(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

export function videoUrl(videoId: string, isShort: boolean): string {
  return isShort
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

// yt-dlp's flat-playlist output flags shorts via `url` containing `/shorts/`
// or via `ie_key`. Most reliably: the entry's `url` path.
export function isShortFromFlatEntry(entry: { url?: string }): boolean {
  return !!entry.url && entry.url.includes("/shorts/");
}

// yt-dlp's per-video metadata exposes `webpage_url` which already contains
// `/shorts/` for shorts. Fall back to checking `duration <= 60` only as a
// last resort — shorts can technically be longer.
export function isShortFromMeta(meta: { webpage_url?: string; duration?: number }): boolean {
  if (meta.webpage_url && meta.webpage_url.includes("/shorts/")) return true;
  return false;
}

// yt-dlp's upload_date is YYYYMMDD; convert to ISO YYYY-MM-DD.
export function reformatUploadDate(yyyymmdd: string | undefined): string | undefined {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return undefined;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
