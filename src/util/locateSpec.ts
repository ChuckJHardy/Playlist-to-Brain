import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Spec files ship at the repo root, alongside dist/. After `npm i -g`, the
// layout is <prefix>/lib/node_modules/playlist-to-brain/{dist,*.md}. Locally
// (e.g. via `npm start`) we may be running from `src/` or `dist/`.
export function locateSpec(filename: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../..", filename),
    resolve(here, "..", filename),
    resolve(here, filename),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    `${filename} not found. Tried:\n${candidates.map((c) => "  " + c).join("\n")}`,
  );
}
