import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadIndex, resolveRoot } from "../relate/store.js";
import { warn } from "../util/log.js";

export interface ExportOpts {
  out?: string;
  root?: string;
}

// Sanitise a single TSV cell. Tabs and newlines would break the format; we
// also collapse runs of whitespace because the projector renders metadata
// as labels in a tooltip.
function tsvCell(v: string): string {
  return v.replace(/[\t\r\n]+/g, " ").trim();
}

export async function runExportEmbeddings(opts: ExportOpts = {}): Promise<void> {
  const root = resolveRoot(opts.root);
  const outDir = resolve(opts.out ?? process.cwd());

  const index = await loadIndex(root);
  if (!index) {
    throw new Error(
      `no index found at ${root}/.playlist-to-brain/index.json — run 'playlist-to-brain index' first`,
    );
  }
  const entries = Object.entries(index.entries);
  if (entries.length === 0) {
    throw new Error("index is empty — nothing to export");
  }

  await mkdir(outDir, { recursive: true });

  // vectors.tsv: one note per row, tab-separated floats, no header. The
  // projector requires a fixed dim across rows; loadIndex already enforces
  // that on schema load.
  const vectorsLines: string[] = [];
  // metadata.tsv: header row REQUIRED when there are multiple columns
  // (https://projector.tensorflow.org/). Tags joined with `;` so the cell
  // stays single-column.
  const metaLines: string[] = ["path\ttitle\ttags\tauthor"];

  for (const [path, entry] of entries) {
    vectorsLines.push(entry.embedding.join("\t"));
    metaLines.push(
      [
        tsvCell(path),
        tsvCell(entry.title),
        tsvCell(entry.tags.join("; ")),
        tsvCell(entry.author ?? ""),
      ].join("\t"),
    );
  }

  const vectorsPath = resolve(outDir, "vectors.tsv");
  const metadataPath = resolve(outDir, "metadata.tsv");
  await writeFile(vectorsPath, vectorsLines.join("\n") + "\n");
  await writeFile(metadataPath, metaLines.join("\n") + "\n");

  warn(`exported ${entries.length} notes (dim ${index.dim})`);
  process.stdout.write(
    JSON.stringify({
      ok: true,
      count: entries.length,
      dim: index.dim,
      vectors: vectorsPath,
      metadata: metadataPath,
    }) + "\n",
  );
}
