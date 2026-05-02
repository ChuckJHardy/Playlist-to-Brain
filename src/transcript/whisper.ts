import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { run, runOrFail } from "../util/run.js";
import { debug } from "../util/log.js";

const MODEL_DIR = process.env.WHISPER_MODEL_DIR ?? join(homedir(), ".local/share/whisper");
const MODEL_NAME = process.env.WHISPER_MODEL_NAME ?? "ggml-large-v3-turbo.bin";

// Homebrew renamed the binary from `whisper-cpp` to `whisper-cli` in
// whisper.cpp 1.7+; older installs may still ship `whisper-cpp`. Try both.
const WHISPER_BIN_CANDIDATES = ["whisper-cli", "whisper-cpp"] as const;

export function whisperModelPath(): string {
  return join(MODEL_DIR, MODEL_NAME);
}

export async function whisperBinary(): Promise<string | null> {
  for (const bin of WHISPER_BIN_CANDIDATES) {
    const v = await run(bin, ["--help"], { swallowSpawnErrors: true });
    if (v.code !== 127) return bin;
  }
  return null;
}

export async function whisperAvailable(): Promise<{ binary: boolean; model: boolean }> {
  return {
    binary: (await whisperBinary()) !== null,
    model: existsSync(whisperModelPath()),
  };
}

// Download audio with yt-dlp + ffmpeg (mp3 16kHz mono is fine; whisper-cpp
// resamples internally if needed) and run whisper-cpp on it. Returns plain
// text (still feed through cleanText).
export async function transcribeWithWhisper(videoId: string): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), "p2b-whisper-"));
  try {
    const audioOut = join(tmp, "audio.%(ext)s");
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    debug(`whisper: downloading audio for ${videoId}`);
    await runOrFail("yt-dlp", [
      "-x",
      "--audio-format",
      "wav",
      "--audio-quality",
      "0",
      "--postprocessor-args",
      "-ar 16000 -ac 1",
      "--no-warnings",
      "-o",
      audioOut,
      url,
    ]);

    const files = await readdir(tmp);
    const wav = files.find((f) => f.endsWith(".wav"));
    if (!wav) throw new Error("yt-dlp did not produce a wav file");
    const wavPath = join(tmp, wav);

    const txtPrefix = join(tmp, "transcript");
    const bin = await whisperBinary();
    if (!bin) throw new Error("whisper-cli (or whisper-cpp) not found on PATH");
    debug(`whisper: running ${bin} on ${wavPath}`);
    await runOrFail(bin, [
      "-m",
      whisperModelPath(),
      "-f",
      wavPath,
      "-otxt",
      "-of",
      txtPrefix,
      "-l",
      "en",
      "-nt", // no timestamps in plain output
    ]);
    return await readFile(`${txtPrefix}.txt`, "utf8");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
