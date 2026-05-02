import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../util/run.js";
import { debug } from "../util/log.js";

// Try to fetch YouTube auto-captions for a video. Returns the parsed plain
// text (still cue-laden — feed through cleanText) or null if no captions.
export async function fetchAutoSubs(videoId: string): Promise<string | null> {
  const tmp = await mkdtemp(join(tmpdir(), "p2b-subs-"));
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const r = await run(
      "yt-dlp",
      [
        "--skip-download",
        "--write-auto-sub",
        "--write-sub",
        "--sub-lang",
        "en.*,en",
        "--sub-format",
        "vtt",
        "--no-warnings",
        "-o",
        join(tmp, "%(id)s.%(ext)s"),
        url,
      ],
      { swallowSpawnErrors: true },
    );
    if (r.code !== 0) {
      debug(`yt-dlp auto-sub fetch failed: ${r.stderr.trim()}`);
    }
    const files = await readdir(tmp);
    const vtt = files.find((f) => f.endsWith(".vtt"));
    if (!vtt) return null;
    const raw = await readFile(join(tmp, vtt), "utf8");
    return parseVtt(raw);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// Strip WEBVTT header, timing lines, and cue settings — return only spoken text.
function parseVtt(raw: string): string {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("WEBVTT")) continue;
    if (trimmed.startsWith("NOTE")) continue;
    if (trimmed.startsWith("Kind:") || trimmed.startsWith("Language:")) continue;
    // Timing lines: "00:00:00.000 --> 00:00:03.000 ..."
    if (/^\d\d:\d\d:\d\d\.\d{3}\s+-->/.test(trimmed)) continue;
    // Sequence numbers (some VTTs include them).
    if (/^\d+$/.test(trimmed)) continue;
    out.push(trimmed);
  }
  return out.join("\n");
}
