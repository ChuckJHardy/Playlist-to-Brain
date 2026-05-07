import { refreshIndex, resolveRoot } from "../relate/store.js";
import { warn } from "../util/log.js";

export interface IndexOpts {
  force?: boolean;
  root?: string;
  quiet?: boolean;
}

export async function runIndex(opts: IndexOpts = {}): Promise<void> {
  const root = resolveRoot(opts.root);
  const { result } = await refreshIndex(root, { force: opts.force });

  if (!opts.quiet) {
    warn(
      `indexed ${result.total} (added ${result.added}, updated ${result.updated}, removed ${result.removed}, unchanged ${result.unchanged})`,
    );
  }
  process.stdout.write(JSON.stringify({ ok: true, ...result }) + "\n");
}
