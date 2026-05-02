import { spawn, SpawnOptions } from "node:child_process";
import { debug } from "./log.js";

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface RunOptions extends SpawnOptions {
  input?: string;
  // If true, spawn errors (e.g. ENOENT) are returned as a non-zero result
  // instead of throwing. Default: throw.
  swallowSpawnErrors?: boolean;
}

export async function run(
  cmd: string,
  args: string[],
  opts: RunOptions = {},
): Promise<RunResult> {
  debug(`spawn: ${cmd} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (b) => (stdout += b.toString()));
    child.stderr!.on("data", (b) => (stderr += b.toString()));
    child.on("error", (err) => {
      if (opts.swallowSpawnErrors) {
        resolve({ stdout, stderr: stderr + String(err), code: 127 });
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
    if (opts.input !== undefined) {
      child.stdin!.write(opts.input);
      child.stdin!.end();
    }
  });
}

export async function runOrFail(
  cmd: string,
  args: string[],
  opts: RunOptions = {},
): Promise<string> {
  const result = await run(cmd, args, opts);
  if (result.code !== 0) {
    throw new Error(
      `${cmd} exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result.stdout;
}
