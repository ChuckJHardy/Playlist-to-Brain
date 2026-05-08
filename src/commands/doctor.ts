import { run } from "../util/run.js";
import { whisperBinary, whisperModelPath } from "../transcript/whisper.js";
import { existsSync } from "node:fs";
import { embeddingCacheDir, embeddingModelDownloaded, EMBEDDING_MODEL } from "../embeddings/model.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function checkBinary(name: string, args: string[] = ["--version"]): Promise<Check> {
  const r = await run(name, args, { swallowSpawnErrors: true });
  // whisper-cli/whisper-cpp exits non-zero on --help/--version on some
  // builds; treat "spawn worked at all" (code !== 127) as evidence it's
  // installed.
  const ok = r.code !== 127;
  const detail = ok ? (r.stdout || r.stderr).split("\n")[0]?.trim() || "ok" : "not found";
  return { name, ok, detail };
}

async function checkWhisperBinary(): Promise<Check> {
  const bin = await whisperBinary();
  if (!bin) {
    return { name: "whisper-cli", ok: false, detail: "not found (tried whisper-cli, whisper-cpp)" };
  }
  return checkBinary(bin, ["--help"]);
}

export async function runDoctor(): Promise<void> {
  const checks: Check[] = [];
  checks.push(await checkBinary("yt-dlp"));
  checks.push(await checkWhisperBinary());
  checks.push(await checkBinary("ffmpeg", ["-version"]));
  checks.push(await checkBinary("node"));

  const modelPath = whisperModelPath();
  checks.push({
    name: `whisper model (${modelPath})`,
    ok: existsSync(modelPath),
    detail: existsSync(modelPath) ? "present" : "missing",
  });

  // Embedding model is downloaded lazily on first `index` run. Surface its
  // status here for visibility — it is not fatal either way.
  const embedDownloaded = embeddingModelDownloaded();
  checks.push({
    name: `embedding model (${EMBEDDING_MODEL})`,
    ok: true,
    detail: embedDownloaded
      ? `present (${embeddingCacheDir()})`
      : "not yet downloaded (will fetch on first 'index' run)",
  });

  let allOk = true;
  for (const c of checks) {
    const tag = c.ok ? "OK  " : "FAIL";
    process.stdout.write(`${tag}  ${c.name}  —  ${c.detail}\n`);
    if (!c.ok) allOk = false;
  }

  if (!allOk) {
    process.stdout.write("\nTo fix, run:  ./install.sh\n");
    process.exit(1);
  }
}
