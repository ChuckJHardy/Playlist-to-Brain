import { flatPlaylist } from "../youtube/ytdlp.js";
import { isShortFromFlatEntry, videoUrl, reformatUploadDate } from "../youtube/url.js";

export interface ListItem {
  videoId: string;
  title: string;
  channelTitle: string;
  channelDescription: string;
  url: string;
  isShort: boolean;
  uploadDate: string | null;
}

export async function runList(playlistUrl: string): Promise<void> {
  const data = await flatPlaylist(playlistUrl);
  const items: ListItem[] = data.entries
    .filter((e) => !!e.id)
    .map((e) => {
      const isShort = isShortFromFlatEntry(e);
      // --flat-playlist intentionally omits per-video upload_date and channel
      // description. We expose what we have and leave the rest to `meta`.
      return {
        videoId: e.id,
        title: e.title ?? "",
        channelTitle: e.channel ?? e.uploader ?? "",
        channelDescription: "",
        url: videoUrl(e.id, isShort),
        isShort,
        uploadDate: reformatUploadDate(undefined) ?? null,
      };
    });
  process.stdout.write(JSON.stringify(items, null, 2) + "\n");
}
