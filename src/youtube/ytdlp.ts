import { run, runOrFail } from "../util/run.js";

export interface FlatEntry {
  id: string;
  title: string;
  url?: string;
  channel?: string;
  channel_url?: string;
  uploader?: string;
}

export interface FlatPlaylist {
  entries: FlatEntry[];
  title?: string;
}

export interface VideoMeta {
  id: string;
  title: string;
  channel?: string;
  uploader?: string;
  channel_id?: string;
  channel_description?: string;
  description?: string;
  upload_date?: string;
  webpage_url?: string;
  duration?: number;
}

export async function ytDlpAvailable(): Promise<boolean> {
  const r = await run("yt-dlp", ["--version"], { swallowSpawnErrors: true });
  return r.code === 0;
}

export async function flatPlaylist(playlistUrl: string): Promise<FlatPlaylist> {
  const stdout = await runOrFail("yt-dlp", [
    "-J",
    "--flat-playlist",
    "--no-warnings",
    playlistUrl,
  ]);
  const data = JSON.parse(stdout);
  // Single-video URLs come back without an `entries` array; normalize.
  if (Array.isArray(data.entries)) {
    return { entries: data.entries as FlatEntry[], title: data.title };
  }
  return { entries: [data as FlatEntry], title: data.title };
}

export async function videoMeta(videoId: string): Promise<VideoMeta> {
  const stdout = await runOrFail("yt-dlp", [
    "-J",
    "--no-warnings",
    `https://www.youtube.com/watch?v=${videoId}`,
  ]);
  return JSON.parse(stdout) as VideoMeta;
}

// Light-touch channel description: yt-dlp's video JSON exposes `channel`
// and `uploader` but not the channel description. We fetch the channel
// page once when needed.
export async function channelDescription(channelUrl: string): Promise<string | undefined> {
  if (!channelUrl) return undefined;
  const r = await run("yt-dlp", [
    "-J",
    "--flat-playlist",
    "--playlist-items",
    "0",
    "--no-warnings",
    channelUrl,
  ], { swallowSpawnErrors: true });
  if (r.code !== 0) return undefined;
  try {
    const data = JSON.parse(r.stdout);
    return typeof data.description === "string" ? data.description : undefined;
  } catch {
    return undefined;
  }
}
