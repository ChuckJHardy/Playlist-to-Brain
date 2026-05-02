# Playlist to Brain

Turn a YouTube playlist into atomic Zettelkasten notes inside an Obsidian vault. A coding agent orchestrates; this CLI is a primitive toolbox that fetches playlist data, video metadata, and transcripts.

The CLI itself needs no LLM provider API key, no Google OAuth, and no browser cookies. Your chosen coding agent may require its own login or API key. Local Whisper transcription kicks in automatically when YouTube has no captions.

## Why use this

If you already use a "watch later"-style YouTube playlist as a queue of things you mean to learn from, the videos pile up faster than you watch them — and even when you do watch, the ideas don't stick. This tool turns that queue into searchable, linkable notes in your second brain.

You get, per video:

- A short **summary** of the atomic idea.
- **Key takeaways** distilled from the transcript.
- **Open questions** to think about further.
- The full **cleaned transcript** at the bottom, so you can grep, quote, and link to it later.
- YAML frontmatter with `tags`, `author` as an Obsidian `[[wikilink]]`, and the canonical source URL — so authors and topics auto-link across your vault.

The result: a playlist of 30 unwatched videos becomes 30 notes you can actually search, connect, and revisit. Authors become hubs; tags become indexes; the transcripts stay greppable.

## Example output

A real note generated from a short video — saved as `one-more-rep-one-more-day.md` in the Inbox folder:

```markdown
---
tags: [resilience, mindset, personal-growth]
source: https://www.youtube.com/watch?v=EXAMPLE
videoId: EXAMPLE
author: "[[Example Author]]"
type: YouTube Video
published: 2025-12-10
---

## Summary
You're not supposed to feel amazing every day. Tough days are not a deviation from
a meaningful life — they're a constituent part of one. Survival on hard days is
"one more rep, one more day."

## Key Takeaways
- The expectation of feeling great daily is the source of the suffering, not the
  bad days themselves.
- Where you are right now, including the difficulty, is where you're meant to be.
- On the hardest days, shrink the unit: one more rep, one more day. Not the year,
  not the goal.

## Open Questions
- Where am I treating an off day as a failure of the system instead of a feature
  of it?
- What's my "one more rep" version of getting through today?

---

## Transcript
This is a pretty important one. Everything changed for me when I realized ...
```

The shape — frontmatter, summary, takeaways, open questions, transcript — is fixed by [`AGENTS_SPEC.md`](./AGENTS_SPEC.md). The wording inside each section is written by your coding agent.

## Install

Requires macOS with Homebrew.

```bash
git clone https://github.com/<you>/playlist-to-brain.git
cd playlist-to-brain
./install.sh
```

The installer prints what it's about to do before doing it. It installs `yt-dlp`, `whisper-cpp`, `ffmpeg`, and `node` via Homebrew, downloads the whisper model (~1.5 GB), runs `npm install` and `npm run build`, then links the CLI globally with `npm install -g .`. Anything already present is skipped.

Verify:

```bash
playlist-to-brain doctor
```

## Set up your Obsidian vault

Decide which folder in your vault should receive the notes — typically `Inbox/`. Then copy the agent instruction template into that folder using the filename your agent expects:

```bash
# from the cloned repo, with VAULT pointing at your vault
# choose one or both, depending on which agent you use

# Anthropic Claude Code
cp templates/vault-Inbox-agent.md "$VAULT/Inbox/CLAUDE.md"

# OpenAI Codex
cp templates/vault-Inbox-agent.md "$VAULT/Inbox/AGENTS.md"

# optional but recommended
cp templates/tags.md "$VAULT/Inbox/tags.md"
```

Start the agent that matches the instruction file you created. If you use both agents in the same vault folder, copy the template to both filenames. The template content is identical; only the filename changes.

What each file does:

- **`CLAUDE.md` / `AGENTS.md`** — tells the coding agent, when run from this folder, that the user phrase "process this playlist: <url>" means "run `playlist-to-brain` and follow `AGENTS_SPEC.md`." Claude Code auto-loads `CLAUDE.md`; OpenAI Codex auto-loads `AGENTS.md`.
- **`tags.md`** — a flat list of preferred tag names. The agent biases toward this vocabulary instead of inventing fresh tags every video, which keeps your tag index clean. Edit freely; you can also delete it and let the agent pick tags from scratch. The included `tags.md` is a starting point, not a prescription.

## Use

```bash
cd ~/path/to/your-vault/Inbox
claude
> process this playlist: https://www.youtube.com/playlist?list=PL...
```

Or with OpenAI Codex:

```bash
cd ~/path/to/your-vault/Inbox
codex
> process this playlist: https://www.youtube.com/playlist?list=PL...
```

The agent will:

1. Run `playlist-to-brain instructions` — fetches the spec it must follow.
2. Run `playlist-to-brain list <url>` — fetches the queue.
3. Skip any video already in the inbox (matched by `videoId` in frontmatter).
4. For each remaining video: run `meta` + `transcript`, then write `<slug>.md`.

The playlist must be **public or unlisted** — there is no auth.

## When you're done with the playlist

Once the agent has finished, the cleanest move is to **delete the entire YouTube playlist** — the notes already live in your vault, so the playlist has served its purpose.

That doesn't work for every case, though:

- **"Watch Later" can't be deleted** — YouTube only lets you empty it.
- You may want to **keep a playlist around** because you'll add more videos to it later.

For both, open the playlist page in your browser, open DevTools → Console, and paste the contents of [`bulk-remove-from-playlist.js`](./bulk-remove-from-playlist.js). It opens each video's "More actions" menu and clicks "Remove from playlist" with a small delay. Watch the console — it logs each removal.

## Subcommands

| Command | What it does |
|---|---|
| `instructions` | Prints `AGENTS_SPEC.md` for the agent to read. |
| `doctor` | Checks all dependencies and the whisper model. |
| `list <url>` | Playlist → JSON. No auth — playlist must be public or unlisted. |
| `meta <id>` | One video → JSON metadata for the author rule. |
| `transcript <id>` | Auto-captions → cleaned text. Falls back to whisper-cpp. |

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `WHISPER_MODEL_DIR` | `~/.local/share/whisper` | Where to look for the model. |
| `WHISPER_MODEL_NAME` | `ggml-large-v3-turbo.bin` | Which model to use. Swap to `ggml-large-v3.bin` etc. |
| `PLAYLIST_TO_BRAIN_DEBUG` | unset | Set to `1` for spawn-level logging on stderr. |

## Out of scope

- Editing existing notes
- Multi-playlist batching in one invocation
- Fully-private playlists (OAuth)
- Auto-deletion from playlists
- Run stats / quota tracking
