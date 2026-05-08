import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getEmbedder } from "../embeddings/model.js";
import { topK } from "../embeddings/cosine.js";
import {
  extractFacets,
  buildEmbeddingText,
  summaryForOutput,
} from "../notes/parse.js";
import {
  loadIndex,
  refreshIndex,
  resolveRoot,
  vaultRelative,
  indexIsStale,
  type IndexFile,
} from "../relate/store.js";
import { warn } from "../util/log.js";

export interface RelatedOpts {
  limit?: number;
  root?: string;
}

export interface RelatedResult {
  path: string;
  title: string;
  tags: string[];
  author: string | null;
  summary: string;
  takeaways: string[];
  score: number;
}

export async function runRelated(notePath: string, opts: RelatedOpts = {}): Promise<void> {
  const root = resolveRoot(opts.root);
  const targetAbs = resolve(notePath);
  if (!existsSync(targetAbs)) {
    throw new Error(`note not found: ${targetAbs}`);
  }

  let index: IndexFile | null = await loadIndex(root);
  if (!index || (await indexIsStale(root))) {
    warn(`[related] index missing or stale, rebuilding…`);
    const refreshed = await refreshIndex(root);
    index = refreshed.index;
  }

  const targetRel = vaultRelative(root, targetAbs);
  const raw = await readFile(targetAbs, "utf8");
  const facets = extractFacets(targetAbs, raw);
  const queryText = buildEmbeddingText(facets);

  if (!queryText.trim()) {
    warn(`[related] target has no embeddable content`);
    process.stdout.write("[]\n");
    return;
  }

  const candidates: { data: { path: string; entry: IndexFile["entries"][string] }; embedding: number[] }[] = [];
  for (const [path, entry] of Object.entries(index.entries)) {
    if (path === targetRel) continue;
    candidates.push({ data: { path, entry }, embedding: entry.embedding });
  }

  if (candidates.length === 0) {
    process.stdout.write("[]\n");
    return;
  }

  const embedder = await getEmbedder();
  const queryVec = await embedder(queryText);
  const limit = Math.max(1, opts.limit ?? 15);
  const ranked = topK(queryVec, candidates, limit);

  const out: RelatedResult[] = ranked.map(({ item, score }) => ({
    path: item.path,
    title: item.entry.title,
    tags: item.entry.tags,
    author: item.entry.author,
    summary: summaryForOutput(item.entry.summary),
    takeaways: item.entry.takeaways,
    score: Number(score.toFixed(4)),
  }));

  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}
