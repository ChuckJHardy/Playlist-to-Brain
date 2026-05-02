#!/usr/bin/env node
import { Command } from "commander";
import { runInstructions } from "./commands/instructions.js";
import { runDoctor } from "./commands/doctor.js";
import { runList } from "./commands/list.js";
import { runMeta } from "./commands/meta.js";
import { runTranscript } from "./commands/transcript.js";
import { fail } from "./util/log.js";

const program = new Command();

program
  .name("playlist-to-brain")
  .description("Primitive toolbox for turning YouTube playlists into Obsidian notes. A coding agent orchestrates.")
  .version("0.1.0");

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

program.parseAsync().catch((e) => fail((e as Error).message));
