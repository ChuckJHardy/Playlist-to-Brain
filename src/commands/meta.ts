import { videoMeta, channelDescription } from "../youtube/ytdlp.js";
import { isShortFromMeta, reformatUploadDate } from "../youtube/url.js";

export interface MetaOutput {
  videoId: string;
  title: string;
  channelTitle: string;
  channelDescription: string;
  uploadDate: string | null;
  isShort: boolean;
  url: string;
  duration: number | null;
}

export async function runMeta(videoId: string): Promise<void> {
  const m = await videoMeta(videoId);
  const channelTitle = m.channel ?? m.uploader ?? "";
  const isShort = isShortFromMeta(m);
  const desc = await channelDescription(m.channel_id ? `https://www.youtube.com/channel/${m.channel_id}` : "");
  const out: MetaOutput = {
    videoId: m.id,
    title: m.title,
    channelTitle,
    channelDescription: desc ?? "",
    uploadDate: reformatUploadDate(m.upload_date) ?? null,
    isShort,
    url: m.webpage_url ?? `https://www.youtube.com/watch?v=${m.id}`,
    duration: typeof m.duration === "number" ? Math.round(m.duration) : null,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}
