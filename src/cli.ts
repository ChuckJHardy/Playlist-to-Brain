#!/usr/bin/env node
import { Command } from "commander";
import { runInstructions } from "./commands/instructions.js";
import { runDoctor } from "./commands/doctor.js";
import { runList } from "./commands/list.js";
import { runMeta } from "./commands/meta.js";
import { runTranscript } from "./commands/transcript.js";
import { runIndex } from "./commands/index_.js";
import { runRelated } from "./commands/related.js";
import { runRelateInstructions } from "./commands/relateInstructions.js";
import { fail } from "./util/log.js";

const program = new Command();

program
  .name("playlist-to-brain")
  .description("Primitive toolbox for turning YouTube playlists into Obsidian notes. A coding agent orchestrates.")
  .version("0.2.0");

program
  .command("instructions")
  .description("Print the AGENTS_SPEC.md that the coding agent should follow this session")
  .action(async () => {
    try { await runInstructions(); } catch (e) { fail((e as Error).message); }
  });

program
  .command("doctor")
  .description("Verify yt-dlp, whisper-cpp, ffmpeg, node, and the whisper model are installed")
  .action(async () => {
    try { await runDoctor(); } catch (e) { fail((e as Error).message); }
  });

program
  .command("list <playlist-url>")
  .description("Print the playlist as JSON: [{videoId, title, channelTitle, url, isShort, ...}]")
  .action(async (url: string) => {
    try { await runList(url); } catch (e) { fail((e as Error).message); }
  });

program
  .command("meta <videoId>")
  .description("Print per-video metadata as JSON for the author rule")
  .action(async (id: string) => {
    try { await runMeta(id); } catch (e) { fail((e as Error).message); }
  });

program
  .command("transcript <videoId>")
  .description("Print cleaned, punctuated paragraphs (no timestamps). Auto-captions first, whisper fallback.")
  .action(async (id: string) => {
    try { await runTranscript(id); } catch (e) { fail((e as Error).message); }
  });

program
  .command("index")
  .description("Build/update the local semantic index of vault notes used by `related`")
  .option("--force", "re-embed every note regardless of mtime")
  .option("--root <dir>", "vault root (defaults to CWD)")
  .option("--quiet", "suppress stderr summary")
  .action(async (opts: { force?: boolean; root?: string; quiet?: boolean }) => {
    try { await runIndex(opts); } catch (e) { fail((e as Error).message); }
  });

program
  .command("related <note-path>")
  .description("Print top-K related notes from the index as JSON for the agent to pick from")
  .option("--limit <n>", "max candidates to return", "15")
  .option("--root <dir>", "vault root (defaults to CWD)")
  .action(async (notePath: string, opts: { limit?: string; root?: string }) => {
    try {
      await runRelated(notePath, {
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        root: opts.root,
      });
    } catch (e) { fail((e as Error).message); }
  });

program
  .command("relate-instructions")
  .description("Print RELATE_SPEC.md — the workflow the agent follows to add `## Related` sections")
  .action(async () => {
    try { await runRelateInstructions(); } catch (e) { fail((e as Error).message); }
  });

program.parseAsync().catch((e) => fail((e as Error).message));
