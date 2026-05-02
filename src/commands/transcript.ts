import { fetchAutoSubs } from "../transcript/autoSubs.js";
import { transcribeWithWhisper } from "../transcript/whisper.js";
import { cleanText } from "../transcript/clean.js";
import { warn } from "../util/log.js";

export async function runTranscript(videoId: string): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await fetchAutoSubs(videoId);
  } catch (err) {
    warn(`auto-subs failed: ${(err as Error).message}`);
  }

  if (!raw || raw.trim().length === 0) {
    warn(`no auto-captions for ${videoId} — falling back to whisper-cpp`);
    raw = await transcribeWithWhisper(videoId);
  }

  process.stdout.write(cleanText(raw) + "\n");
}
