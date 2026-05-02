# Important System Information

- When building you only have access to the folder you are in, you don't get to look at any parent folders.

## Context

You want to turn YouTube playlists (public or unlisted, including Shorts) into atomic Zettelkasten notes inside your Obsidian vault, with no LLM provider API key required by this CLI and nothing landing in the vault except `.md` files. The friction today is manual: watching, transcribing in your head, summarizing, filing. The intended outcome is a tool you invoke from a coding-agent session inside `Inbox/` that walks the playlist, transcribes each video locally, asks the active agent to write a structured note, and saves it. The CLI makes no LLM API call; your chosen agent provides that step. Transcription is local via Whisper, and there is no Google OAuth setup since playlist deletion was dropped.

## Architecture

**A coding agent orchestrates; the CLI is a primitive toolbox.** A globally-installed `playlist-to-brain` TypeScript CLI exposes small read-only subcommands. The active agent, such as Anthropic Claude Code or OpenAI Codex, calls those subcommands, reads the output, and writes notes using its own file tools. The CLI itself needs no LLM provider API key; your chosen agent may require its own login or API key.

**Nothing is written into the vault except `.md` files.** No state file, no `.processed.json`, no config. Idempotency is achieved by scanning `Inbox/*.md` frontmatter for an existing `videoId` field — that's how we know what's already done.

**No Google API, no OAuth, no browser cookies.** Playlists are kept public or unlisted by convention, so `yt-dlp` reads them with no auth at all — works on any machine with just `yt-dlp` installed. Fully-private playlists are out of scope. Auto-delete from the playlist was explicitly dropped — you'll prune the playlist manually on YouTube after a session.

## CLI subcommands

Each is read-only or writes only to stdout. None of them touch the vault.

| Command | Purpose |
|---|---|
| `playlist-to-brain instructions` | Print the system prompt the coding agent should follow this session (note shape, tag rules, author rule, skip rules). The agent reads this first. |
| `playlist-to-brain doctor` | Verify `yt-dlp`, `whisper-cpp`, `ffmpeg`, and the `ggml-large-v3.bin` model are installed; print exact install commands if not. |
| `playlist-to-brain list <playlist-url>` | Run `yt-dlp -J --flat-playlist`, output JSON: `[{videoId, title, channelTitle, channelDescription, url, isShort, uploadDate}]`. No auth — assumes the playlist is public or unlisted. |
| `playlist-to-brain transcript <videoId>` | Try YouTube auto-captions first via `yt-dlp --write-auto-sub --skip-download`; on miss, download audio and run `whisper-cpp` with `large-v3-turbo`. Output cleaned, punctuated paragraphs to stdout — no timestamps. |
| `playlist-to-brain meta <videoId>` | Output channel title, channel description, upload date, full title — used by the agent to apply the author rule. |

## Per-video workflow (executed by the coding agent)

1. Call `playlist-to-brain instructions` and follow the spec.
2. Call `playlist-to-brain list <url>`.
3. Read every `.md` in CWD; collect existing `videoId` values from frontmatter. For each, warn `"<videoId> already in <file> — skipping"` and remove from the queue.
4. Read `Inbox/tags.md` if it exists; treat its tags as the preferred vocabulary. If absent, print one line `"no tags.md found, choosing tags freely"`.
5. For each remaining video:
   - Call `meta <videoId>`. Apply the author rule (below).
   - Call `transcript <videoId>`.
   - Compose the note (template below). Pick tags biased toward `tags.md` where reasonable.
   - Write `Inbox/<slug>.md`. On filename collision, append ` 2`, ` 3`, etc.
   - Read the file back, verify YAML parses.
   - Move on. No state file is written.

## Author rule

- Default `author` to the channel title wrapped as `[[Channel Title]]` if the channel reads as a person (heuristic on channel title + description, judged by the agent).
- If the channel is an organization (e.g., "TED"), parse the video title for a speaker name (e.g., `"Chase Hughes: How to..."` → `Chase Hughes`). Use that, wrapped as `[[Chase Hughes]]`.
- If neither yields a person, **omit the `author` field entirely** — do not skip the video.

## Note template

```markdown
---
tags: [persuasion, communication]
source: https://www.youtube.com/watch?v=MGkNU9D_aI8
videoId: MGkNU9D_aI8
author: "[[Chase Hughes]]"
type: YouTube Video
published: 2024-08-12
---

## Summary
One paragraph capturing the atomic idea.

## Key Takeaways
- ...
- ...

## Open Questions
- ...
- ...

---

## Transcript
Cleaned, punctuated paragraphs. No timestamps.
```

Notes:
- `source` URL has `?si=...` share tracking stripped.
- Shorts use `https://www.youtube.com/shorts/<id>` form.
- `videoId` is the dedupe key for resume.
- `published` is `yt-dlp`'s `upload_date` reformatted to `YYYY-MM-DD`.

## Decisions locked in (from our Q&A)

- Architecture: Option A (coding agent orchestrates, CLI is primitive toolbox).
- Auto-delete from playlist: dropped. No OAuth, no Google Cloud project.
- Playlist visibility: public or unlisted only. No `--cookies-from-browser`, no browser dependency. Fully-private playlists out of scope.
- Transcription: local-only. Auto-captions first via `yt-dlp`, fallback to `whisper-cpp` with `ggml-large-v3-turbo.bin` (newest model in the repo as of late 2024; quality near-identical to `large-v3` for English with ~6x speedup).
- Notes location: `Inbox/` subfolder of the vault (CWD when running).
- Tag vocabulary: read `Inbox/tags.md` if present, otherwise free choice with a one-line notice.
- Title style: whatever fits the video; concise and meaningful.
- Author: must be a person; wrapped as `[[Name]]`; try title-extraction for org channels; if no person can be identified, omit the field but keep the note.
- Transcript appendix: cleaned punctuated paragraphs, no timestamps.
- Body sections: Summary / Key Takeaways / Open Questions.
- Confirmation prompts: none, run autonomously.
- Existing notes with same `videoId`: warn and skip.
- Run stats / quota tracking: removed — keep the CLI quiet.
- Install: global `npm i -g`. Vault contains only `.md` files.

## Dependencies the user installs once

A single bootstrap script does it all — no manual brew commands.

```bash
cd ~/Developer/playlist-to-brain   # or wherever the CLI repo lives
./install.sh
```

What `install.sh` does (idempotent — safe to re-run):

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Homebrew deps (skipped if already present)
for pkg in yt-dlp whisper-cpp ffmpeg node; do
  if ! brew list --formula "$pkg" >/dev/null 2>&1; then
    brew install "$pkg"
  fi
done

# 2. Whisper model — defaults to large-v3-turbo, override with $WHISPER_MODEL_NAME
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-large-v3-turbo.bin}"
MODEL_DIR="${WHISPER_MODEL_DIR:-$HOME/.local/share/whisper}"
mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL_DIR/$MODEL_NAME" ]; then
  curl -L --fail \
    -o "$MODEL_DIR/$MODEL_NAME" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL_NAME"
fi

# 3. Build & install the CLI globally
npm install
npm run build
npm install -g .

echo "Done. Run 'playlist-to-brain doctor' to verify."
```

`playlist-to-brain doctor` re-checks the same four binaries and the model file at runtime, printing the exact `install.sh` invocation if anything is missing. The model path is read from `WHISPER_MODEL_DIR` + `WHISPER_MODEL_NAME` so you can swap to `large-v3` or a quantized variant by changing two env vars and re-running `install.sh` — no code change.

## CLI source layout

The CLI repo lives outside the vault (suggested: `~/Developer/playlist-to-brain/`). Globally installed via `npm i -g .` after build.

```
playlist-to-brain/
  PLAN.md                      # this plan, copied here verbatim so it lives with the code
  README.md                    # short user-facing usage
  install.sh                   # bootstrap: brew deps + whisper model + npm build/link
  package.json
  tsconfig.json
  src/
    cli.ts                     # commander entry, dispatches subcommands
    commands/
      instructions.ts          # prints the AGENTS_SPEC.md content
      doctor.ts                # checks yt-dlp / whisper-cpp / ffmpeg / model
      list.ts                  # yt-dlp -J --flat-playlist → JSON to stdout
      transcript.ts            # auto-subs → fallback to whisper-cpp
      meta.ts                  # per-video metadata for author rule
    youtube/
      ytdlp.ts                 # spawn helpers, JSON parsing
      url.ts                   # parsePlaylistUrl, stripShareTracking, isShort
    transcript/
      autoSubs.ts              # download + parse VTT, strip timestamps, clean
      whisper.ts               # extract audio with ffmpeg, run whisper-cpp
      clean.ts                 # punctuation/paragraphing pass on raw text
    util/
      run.ts                   # child_process wrapper with stderr capture
      log.ts                   # quiet by default
  AGENTS_SPEC.md               # the source of truth that `instructions` prints
  templates/
    vault-Inbox-agent.md       # copy to CLAUDE.md or AGENTS.md inside the vault Inbox
    tags.md                    # optional preferred tag vocabulary
```

## Files to create

All new (greenfield project). Paths above. The two most important files:

- `AGENTS_SPEC.md` — encodes the note shape, author rule, tag rule, skip-existing rule, and workflow. The active coding agent reads this every session via `playlist-to-brain instructions`. Get this file right and the rest is mechanical.
- `PLAN.md` — this plan lives in the repo root as architecture context.

## Verification

End-to-end smoke test using your example playlist `PLmfKycvQVEiyjMuxbyWmeRVIBlUIDfdep`:

1. `playlist-to-brain doctor` → all green.
2. `cd ~/.../Inbox && claude` or `cd ~/.../Inbox && codex` → start a session.
3. Prompt: `process this playlist: https://www.youtube.com/playlist?list=PLmfKycvQVEiyjMuxbyWmeRVIBlUIDfdep`.
4. Expect: the agent calls `instructions`, then `list`, then loops `meta` + `transcript` + file write per video.
5. Inspect 2–3 generated `Inbox/*.md` files:
   - Frontmatter parses (try `yq '.tags' file.md`).
   - `videoId` matches the URL.
   - `author` either present and wrapped `[[...]]`, or absent (never partial).
   - Body has all three sections; transcript appendix is clean prose with no `[00:00]` markers.
6. Re-run on the same playlist: every video should report `"already in <file> — skipping"`. Zero new files created.
7. Edge cases to manually verify:
   - A Short — `source` URL uses `/shorts/` form.
   - A video with no captions — `whisper-cpp` runs and produces clean text (slow but quality).
   - An org-channel video where the title contains the speaker — author parsed from title.
   - A video with neither person-channel nor speaker-in-title — note created without `author` field.
   - A `tags.md` with 5 tags — generated notes prefer those tags.

## What is explicitly not built

- No web UI.
- No multi-playlist batching in one invocation.
- No editing of existing notes.
- No deletion from YouTube playlists (manual cleanup).
- No support for fully-private playlists (must be public or unlisted).
- No state files in the vault (vault stays pure markdown).
- No run-stats reporting / quota tracking.
- No confirmation prompts during the run.
