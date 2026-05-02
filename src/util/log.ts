// Quiet by default. Subcommands print machine-readable output to stdout;
// these helpers go to stderr so they never pollute that contract.

export function warn(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

export function debug(msg: string): void {
  if (process.env.PLAYLIST_TO_BRAIN_DEBUG === "1") {
    process.stderr.write(`[debug] ${msg}\n`);
  }
}

export function fail(msg: string, code = 1): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
