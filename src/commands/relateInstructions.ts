import { readFile } from "node:fs/promises";
import { locateSpec } from "../util/locateSpec.js";

export async function runRelateInstructions(): Promise<void> {
  const path = locateSpec("RELATE_SPEC.md");
  process.stdout.write(await readFile(path, "utf8"));
}
