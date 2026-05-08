import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { warn } from "../util/log.js";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

export function embeddingCacheDir(): string {
  return join(homedir(), ".cache", "playlist-to-brain", "transformers");
}

export function embeddingModelDownloaded(): boolean {
  // The cache layout is <cacheDir>/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx
  // (and a few sibling files). We treat the model dir's existence as
  // evidence — the loader will redownload anything missing.
  return existsSync(join(embeddingCacheDir(), EMBEDDING_MODEL));
}

type Embedder = (text: string) => Promise<number[]>;

let cached: Embedder | null = null;

export async function getEmbedder(): Promise<Embedder> {
  if (cached) return cached;

  const firstRun = !embeddingModelDownloaded();
  if (firstRun) {
    warn("[playlist-to-brain] downloading embedding model (~22MB, one-time)…");
  }

  // Configure the transformers.js cache before importing the pipeline so the
  // module-level `env` is set up correctly.
  const tx = await import("@xenova/transformers");
  tx.env.cacheDir = embeddingCacheDir();
  tx.env.allowLocalModels = false;
  tx.env.allowRemoteModels = true;

  const pipe = await tx.pipeline("feature-extraction", EMBEDDING_MODEL, {
    quantized: true,
  });

  cached = async (text: string): Promise<number[]> => {
    // mean-pool + L2 normalize gives a stable sentence vector. With these on,
    // cosine similarity is just a dot product.
    const out = await pipe(text, { pooling: "mean", normalize: true });
    return Array.from(out.data as Float32Array);
  };
  return cached;
}
