import { readdir, readFile, stat, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { EMBEDDING_DIM, EMBEDDING_MODEL, getEmbedder } from "../embeddings/model.js";
import {
  buildEmbeddingText,
  extractFacets,
  summaryForOutput,
  type NoteFacets,
} from "../notes/parse.js";
import { warn, debug } from "../util/log.js";

export const INDEX_VERSION = 1;
export const INDEX_RELPATH = ".playlist-to-brain/index.json";

const EXCLUDED_DIRS = new Set([
  ".playlist-to-brain",
  ".obsidian",
  ".trash",
  ".git",
  "node_modules",
]);

export interface IndexEntry {
  mtime: number;
  title: string;
  tags: string[];
  author: string | null;
  summary: string;
  takeaways: string[];
  embedding: number[];
}

export interface IndexFile {
  version: number;
  model: string;
  dim: number;
  updated: string;
  entries: Record<string, IndexEntry>;
}

export function emptyIndex(): IndexFile {
  return {
    version: INDEX_VERSION,
    model: EMBEDDING_MODEL,
    dim: EMBEDDING_DIM,
    updated: new Date().toISOString(),
    entries: {},
  };
}

export function indexPath(root: string): string {
  return join(root, INDEX_RELPATH);
}

export async function loadIndex(root: string): Promise<IndexFile | null> {
  const p = indexPath(root);
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as IndexFile;
    // Schema-version or model mismatch invalidates the file — caller will
    // treat this as "no index" and rebuild from scratch.
    if (parsed.version !== INDEX_VERSION) return null;
    if (parsed.model !== EMBEDDING_MODEL) return null;
    if (parsed.dim !== EMBEDDING_DIM) return null;
    return parsed;
  } catch (e) {
    warn(`[index] could not parse ${p} (${(e as Error).message}); rebuilding`);
    return null;
  }
}

export async function saveIndex(root: string, file: IndexFile): Promise<void> {
  const p = indexPath(root);
  await mkdir(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await writeFile(tmp, JSON.stringify(file));
  await rename(tmp, p);
}

export async function walkVaultMarkdown(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith(".") && !EXCLUDED_DIRS.has(e.name)) {
          // Skip every dotdir (e.g. .DS_Store-ish junk dirs) by default —
          // only the explicitly-listed excludes are predictable.
          continue;
        }
        if (EXCLUDED_DIRS.has(e.name)) continue;
        await walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        results.push(full);
      }
    }
  }
  await walk(root);
  return results;
}

export function vaultRelative(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

export interface RefreshResult {
  total: number;
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
}

export async function refreshIndex(
  root: string,
  opts: { force?: boolean } = {},
): Promise<{ index: IndexFile; result: RefreshResult }> {
  const existing = (await loadIndex(root)) ?? emptyIndex();
  // Start from existing entries; we'll prune anything not seen in this walk.
  const next: IndexFile = {
    ...existing,
    updated: new Date().toISOString(),
    entries: { ...existing.entries },
  };

  const files = await walkVaultMarkdown(root);
  const seen = new Set<string>();
  let added = 0;
  let updatedCount = 0;
  let unchanged = 0;

  let embedder: ((text: string) => Promise<number[]>) | null = null;
  const ensureEmbedder = async (): Promise<(text: string) => Promise<number[]>> => {
    if (!embedder) embedder = await getEmbedder();
    return embedder;
  };

  for (const abs of files) {
    const rel = vaultRelative(root, abs);
    seen.add(rel);

    let st;
    try {
      st = await stat(abs);
    } catch {
      continue;
    }
    const mtime = st.mtimeMs;

    const prior = next.entries[rel];
    if (!opts.force && prior && prior.mtime === mtime) {
      unchanged++;
      continue;
    }

    let raw: string;
    try {
      raw = await readFile(abs, "utf8");
    } catch (e) {
      warn(`[index] read failed for ${rel}: ${(e as Error).message}`);
      continue;
    }

    const facets = extractFacets(abs, raw);
    const text = buildEmbeddingText(facets);
    if (!text.trim()) {
      debug(`[index] ${rel} has no embeddable content; skipping`);
      // Still drop any stale prior entry so we don't keep a ghost.
      delete next.entries[rel];
      continue;
    }

    const embed = await ensureEmbedder();
    const embedding = await embed(text);

    next.entries[rel] = {
      mtime,
      title: facets.title,
      tags: facets.tags,
      author: facets.author,
      summary: summaryForOutput(facets.summary),
      takeaways: facets.takeaways,
      embedding,
    };
    if (prior) updatedCount++;
    else added++;
  }

  // Prune entries whose files have been deleted or renamed.
  let removed = 0;
  for (const rel of Object.keys(next.entries)) {
    if (!seen.has(rel)) {
      delete next.entries[rel];
      removed++;
    }
  }

  await saveIndex(root, next);
  return {
    index: next,
    result: {
      total: Object.keys(next.entries).length,
      added,
      updated: updatedCount,
      unchanged,
      removed,
    },
  };
}

// Returns true if any *.md file in the vault has an mtime newer than
// `index.json`'s mtime. Used by `related` to auto-rebuild.
export async function indexIsStale(root: string): Promise<boolean> {
  const p = indexPath(root);
  if (!existsSync(p)) return true;
  let indexMtime: number;
  try {
    indexMtime = (await stat(p)).mtimeMs;
  } catch {
    return true;
  }
  const files = await walkVaultMarkdown(root);
  for (const abs of files) {
    try {
      const st = await stat(abs);
      if (st.mtimeMs > indexMtime) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function resolveRoot(rootArg: string | undefined): string {
  return resolve(rootArg ?? process.cwd());
}

export interface NoteFacetsForQuery extends NoteFacets {}
