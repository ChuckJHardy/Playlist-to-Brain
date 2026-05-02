import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// AGENTS_SPEC.md ships at the repo root, alongside dist/. After `npm i -g`,
// the layout is <prefix>/lib/node_modules/playlist-to-brain/{dist,AGENTS_SPEC.md}.
function locateSpec(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../AGENTS_SPEC.md"),
    resolve(here, "../AGENTS_SPEC.md"),
    resolve(here, "AGENTS_SPEC.md"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    `AGENTS_SPEC.md not found. Tried:\n${candidates.map((c) => "  " + c).join("\n")}`,
  );
}

export async function runInstructions(): Promise<void> {
  const path = locateSpec();
  process.stdout.write(await readFile(path, "utf8"));
}
