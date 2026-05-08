# Playlist to Brain

Turn a YouTube playlist — or a single YouTube video — into atomic Zettelkasten notes inside an Obsidian vault. A coding agent orchestrates; this CLI is a primitive toolbox that fetches playlist data, video metadata, and transcripts.

The CLI itself needs no LLM provider API key, no Google OAuth, and no browser cookies. Your chosen coding agent may require its own login or API key. Local Whisper transcription kicks in automatically when YouTube has no captions.

## Why use this

If you already use a "watch later"-style YouTube playlist as a queue of things you mean to learn from, the videos pile up faster than you watch them — and even when you do watch, the ideas don't stick. This tool turns that queue into searchable, linkable notes in your second brain. The same flow works for one-off videos you want to capture without adding to a playlist first.

You get, per video:

- A short **summary** of the atomic idea.
- **Key takeaways** distilled from the transcript.
- **Open questions** to think about further.
- The full **cleaned transcript** at the bottom, so you can grep, quote, and link to it later.
- YAML frontmatter with `tags`, `author` as an Obsidian `[[wikilink]]`, and the canonical source URL — so authors and topics auto-link across your vault.

The result: a playlist of 30 unwatched videos becomes 30 notes you can actually search, connect, and revisit. Authors become hubs; tags become indexes; the transcripts stay greppable.

## Example output

A real note generated from a short video — saved as `One More Rep One More Day.md` in the Inbox folder:

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

Or for a single video:

```bash
> process this video: https://www.youtube.com/watch?v=KyfUysrNaco
```

`process this: <url>` also works — the agent disambiguates from the URL itself. Same flow with OpenAI Codex (`codex` instead of `claude`).

The agent will:

1. Run `playlist-to-brain instructions` — fetches the spec it must follow.
2. Run `playlist-to-brain list <url>` — fetches the queue (one row for a single video, many for a playlist).
3. Create or update `.playlist-to-brain/playlist-<id>.md` — one progress file per run, named after the playlist's `list` parameter or, for single videos, the video ID.
4. Skip any video already in the inbox (matched by `videoId` in frontmatter), recording it in the progress file.
5. For each remaining video: mark it `in-progress`, run `meta` + `transcript`, write `<Filename>.md` (Title Case, see [`AGENTS_SPEC.md`](./AGENTS_SPEC.md) "Title and filename"), verify it, then mark it `done`.

The playlist or video must be **public or unlisted** — there is no auth.

## Linking new notes to the rest of your vault

After a run, you can ask the agent to add a `## Related` section to each just-created note. The agent picks 3–5 wikilinks to other notes in your vault with a one-sentence reason for each.

```bash
cd ~/path/to/your-vault/Inbox
claude
> find related notes from last run
```

Under the hood:

- `playlist-to-brain index` builds a small local semantic index at `.playlist-to-brain/index.json`. Embeddings come from `Xenova/all-MiniLM-L6-v2` running locally via `@xenova/transformers` — no API key. The model (~22MB) downloads to `~/.cache/playlist-to-brain/transformers/` on first use.
- `playlist-to-brain related <note>` returns the top-15 candidate notes as JSON, with their summaries and takeaways pre-populated. The agent reads that directly — it doesn't re-open candidate files — so token cost stays roughly flat regardless of vault size.
- The relate workflow is the only command flow allowed to edit existing notes. It inserts a single `## Related` section between `## Open Questions` and `## Transcript`. The full spec is at `RELATE_SPEC.md` (also printable via `playlist-to-brain relate-instructions`).
- Re-running is idempotent. A sidecar `.playlist-to-brain/relate-<id>.md` tracks per-note status; notes that already have a `## Related` section are skipped.

For a 500-note vault adding `## Related` to ~10 new notes per run, expect roughly $0.05/run on Sonnet, ~$0.25/run on Opus — about 100× cheaper than feeding the whole vault to the LLM each time.

**Troubleshooting.** If the agent improvises searches (`grep` / `ls` / `find` over the vault), only does one note, or asks for confirmation between notes, your `CLAUDE.md` (or `AGENTS.md`) is from before this feature was added. Re-copy `templates/vault-Inbox-agent.md` over the file in whatever directory you launch `claude` (or `codex`) from — that's where the trigger phrase lives. Updating `npm install -g .` does not update files inside your vault.

## Visualising the embedding cloud

Once you have an index, you can see your vault as a 2D/3D map of semantic clusters using **TensorFlow's Embedding Projector** — a free, browser-based tool. All projection (UMAP / t-SNE / PCA) and nearest-neighbour exploration runs entirely in your browser; your vectors and metadata are never uploaded to a server.

What you need:

1. A built index — run `playlist-to-brain index` from your vault root if you haven't yet.
2. A modern browser (Chrome, Firefox, Safari).
3. No account, no signup, no install.

Workflow:

```bash
cd ~/path/to/your-vault
playlist-to-brain export-embeddings --out ~/Desktop
# writes vectors.tsv and metadata.tsv to ~/Desktop
```

`vectors.tsv` is one note per row, tab-separated floats (384 dims for the default `Xenova/all-MiniLM-L6-v2` model). `metadata.tsv` is one note per row with columns `path`, `title`, `tags`, `author`.

Then:

1. Open <https://projector.tensorflow.org/>.
2. Click **Load** in the left panel (top-left button labelled "Load data from your computer").
3. Upload `vectors.tsv` for "Step 1: Load a TSV file of vectors".
4. Upload `metadata.tsv` for "Step 2: Load a TSV file of metadata".
5. Choose a projection (UMAP works well at this scale) and explore. Click any point to see its 100 nearest neighbours by cosine similarity. Use the search box (right panel) to find a specific note by title or path.

Re-run `playlist-to-brain export-embeddings` whenever the index changes — the projector reads the files at upload time, so refreshing means re-uploading.

## Long videos

Some videos are long enough that the full transcript may not fit in the agent's context window alongside its reasoning. The CLI surfaces `duration` (seconds) in `meta` output and the agent measures the transcript size after fetching, so it can preflight.

When the agent judges a video to be long for its current model, it will print one line warning you and recommend you restart in a higher-context-window model (e.g. Claude with 1M context) for best fidelity, then attempt the note as usual. If the model can't fit the full transcript, the agent automatically falls back to chunked summarization — splitting the transcript into pieces, summarizing each, then synthesizing the final note. The chunked notes are tagged in the progress file so you can spot them and re-run on a larger model later if you want a single-pass version.

## Restarting after token limits

If the coding agent runs out of LLM tokens or the session stops halfway through, start a new agent session in the same `Inbox/` folder and use the same prompt:

```bash
> process this playlist: https://www.youtube.com/playlist?list=PL...
```

The agent will read `.playlist-to-brain/playlist-<playlistId>.md`, reconcile it with existing notes by `videoId`, and resume from the first unfinished video. Each row in that file records the video status, note filename, last update date, and any short error.

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
| `doctor` | Checks all dependencies and the whisper/embedding models. |
| `list <url>` | Playlist or single video → JSON array. No auth — must be public or unlisted. |
| `meta <id>` | One video → JSON metadata for the author rule. Includes `duration` (seconds) for the long-video rule. |
| `transcript <id>` | Auto-captions → cleaned text. Falls back to whisper-cpp. |
| `index` | Build/update the local semantic index of vault notes. |
| `related <note-path>` | Top-K related notes for a given note as JSON, with summaries/takeaways inlined. |
| `relate-instructions` | Prints `RELATE_SPEC.md` — the workflow the agent follows to add `## Related` sections. |
| `export-embeddings` | Exports `vectors.tsv` + `metadata.tsv` for TensorFlow Embedding Projector. |

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `WHISPER_MODEL_DIR` | `~/.local/share/whisper` | Where to look for the model. |
| `WHISPER_MODEL_NAME` | `ggml-large-v3-turbo.bin` | Which model to use. Swap to `ggml-large-v3.bin` etc. |
| `PLAYLIST_TO_BRAIN_DEBUG` | unset | Set to `1` for spawn-level logging on stderr. |

## Other useful tips

- **Clear all liked videos** — If you want to reset your YouTube activity, you can remove all your liked videos at [myactivity.google.com](https://myactivity.google.com/page?page=youtube_likes&continue=https%3A%2F%2Fmyactivity.google.com%2Fproduct%2Fyoutube%2Finteractions%3Fhl%3Den&hl=en). Useful for starting fresh or managing your YouTube profile.

## Out of scope

- Editing existing notes
- Multi-playlist batching in one invocation
- Fully-private playlists (OAuth)
- Auto-deletion from playlists
- Run stats / quota tracking
