# Plan: `## Related` section for new notes (relate workflow)

## Context

After `playlist-to-brain` finishes turning a playlist or single video into Zettelkasten notes, you want a follow-on command that walks each just-created note and adds a `## Related` section linking 3–5 other vault notes with a short reason for each.

The naive approach — feeding the entire vault into the LLM for every new note — burns tokens fast. With a medium vault (200–1,000 notes) and ~10 new notes per run, that's ~1M tokens/run on Sonnet, ~100× more than necessary.

The architecturally consistent fix: the CLI gains a local **semantic index** (embeddings via `@xenova/transformers`, all-MiniLM-L6-v2, ~22MB ONNX, no API key — preserves the "CLI needs no auth" invariant). A new `related <note>` subcommand returns the top-K candidates with their summaries baked in. The agent picks 3–5 with reasoning and inserts the `## Related` section. Roughly **~$0.05/run on Sonnet, ~$0.25/run on Opus** for a 10-note relate pass.

This is the only carve-out from the current "do not edit existing notes" rule — scoped to a single `## Related` block.

## Design overview

```
agent: "find related notes from last run"
   │
   ├─ playlist-to-brain relate-instructions       (prints RELATE_SPEC.md)
   │
   ├─ for each note in latest .playlist-to-brain/playlist-*.md:
   │     ├─ playlist-to-brain related <note>      (top-15 candidates JSON)
   │     ├─ agent picks 3–5, writes reasons
   │     └─ agent edits the note: insert ## Related between
   │        ## Open Questions and ## Transcript
   │
   └─ writes .playlist-to-brain/relate-<id>.md (sidecar progress file)
```

CLI stays a primitive toolbox. LLM work stays in the agent. The only new write target is `.playlist-to-brain/index.json`.

## New CLI subcommands

| Command | Purpose |
|---|---|
| `playlist-to-brain index [--force] [--root <dir>] [--quiet]` | Walk vault `*.md` (skip `.playlist-to-brain/`, `.obsidian/`, `.trash/`, dotdirs), embed each note's `title + tags + author + summary + key takeaways` (NOT transcript — too noisy), upsert `.playlist-to-brain/index.json`. Skip files unchanged by `mtime`. Prune deletions. Atomic write via `.tmp` + rename. Stderr summary `indexed N (added X, updated Y, removed Z)`. |
| `playlist-to-brain related <note-path> [--limit 15] [--root <dir>]` | Auto-builds index if missing or any `*.md` is newer. Embeds the target's `## Summary` block, cosine-similarity vs. index, drops self by canonical path, returns top-K JSON. |
| `playlist-to-brain relate-instructions` | Prints `RELATE_SPEC.md` for the agent to follow. |

`related` JSON output (the agent reads this directly — no extra `Read` calls):

```json
[
  {
    "path": "Inbox/some-note.md",
    "title": "Some Note",
    "tags": ["psychology","habits"],
    "author": "[[Jane Doe]]",
    "summary": "First 500 chars of ## Summary…",
    "takeaways": ["bullet 1","bullet 2"],
    "score": 0.812
  }
]
```

## Index file shape — `.playlist-to-brain/index.json`

```json
{
  "version": 1,
  "model": "Xenova/all-MiniLM-L6-v2",
  "dim": 384,
  "updated": "2026-05-06T14:22:00Z",
  "entries": {
    "Inbox/some-note.md": {
      "mtime": 1714665600123.4,
      "title": "Some Note",
      "tags": ["psychology","habits"],
      "author": "[[Jane Doe]]",
      "summary": "First 500 chars of ## Summary…",
      "takeaways": ["bullet 1","bullet 2","bullet 3"],
      "embedding": [0.0123, -0.0456, ...]
    }
  }
}
```

- Path is **vault-relative**, normalized with `/`. Used as dedupe + self-exclusion key.
- `embedding` is a plain JSON array (~3KB × 1000 ≈ 3MB — fine).
- Bumping `version` or `model` invalidates the whole file.

## New spec — `RELATE_SPEC.md` (repo root)

Outline:

1. **Locate the run.** Find the most-recently-modified `.playlist-to-brain/playlist-*.md` (excluding `relate-*.md`). Read its queue; collect rows where `status == done` and `note` column is non-empty.
2. **Open/create the sidecar** `.playlist-to-brain/relate-<id>.md` — same shape as the playlist progress file, columns `| # | note | status | reason | updated | error |`. Same status semantics (`pending, in-progress, done, skipped, failed`). Idempotent: re-running re-reads, skips `done`/`skipped`, retries `failed`.
3. **Per note:**
   1. If body matches `^## Related\b` (line-anchored regex), mark `skipped` reason `already-related`.
   2. If no `## Summary`, mark `skipped` reason `no-summary`.
   3. Run `playlist-to-brain related <abs-path>` → JSON.
   4. Pick 3–5 by **content reasoning**, not score alone (soft floor ~0.35 cosine). Drop irrelevant high-score matches.
   5. Compose the block (`-` bullets, `_italic_` reason, blank line after heading):

      ```markdown
      ## Related

      - [[Other Note]] — _one-sentence reason._
      - [[Another Note]] — _another reason._
      ```
   6. **Insert** between `## Open Questions` and `## Transcript`. If `## Transcript` missing, append at EOF and log reason. If `## Open Questions` missing, insert directly before `## Transcript`. After insert: collapse `\n{3,}` → `\n\n`, ensure single trailing `\n`.
   7. Read back, verify YAML still parses, verify exactly one `^## Related`, verify Markdown rules from `AGENTS_SPEC.md` §"Markdown formatting" hold. On failure, restore from in-memory backup and mark `failed`.
   8. Mark `done`, update sidecar.
4. **End:** print `playlist-to-brain relate: done=<n> skipped=<n> failed=<n> pending=<n>`.
5. **Carve-out reminder:** the *only* allowed edit-existing-notes workflow. Do not touch frontmatter, `## Summary`, `## Transcript`, etc.

## Wikilink ambiguity

Obsidian resolves `[[X]]` by title, not path. If two index entries share a title, the spec instructs the agent to use path-form `[[folder/note|Display]]`. The CLI exposes both `path` and `title` in its JSON; the agent decides.

## Files to create

| Path | Purpose |
|---|---|
| `src/embeddings/model.ts` | Lazy singleton over `@xenova/transformers` `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')`. Pin `env.cacheDir = ~/.cache/playlist-to-brain/transformers`. Print `[indexing] downloading model ~22MB on first run` to stderr **before** the await (otherwise users see a 30s hang). Mean-pool + L2-normalize → 384-dim vectors. |
| `src/embeddings/cosine.ts` | `cosine(a, b)` (dot product on normalized vectors), `topK(query, items, k)`. |
| `src/notes/parse.ts` | `parseFrontmatter(raw)` (handles missing `---`), `extractSection(body, heading)` (ends at next `## ` or EOF), `extractTitle(path, fm, body)` (H1 → filename stem), `buildEmbeddingText(...)` (truncate to ~2KB chars; MiniLM caps at 256 tokens internally). |
| `src/commands/index_.ts` | `playlist-to-brain index` implementation. |
| `src/commands/related.ts` | `playlist-to-brain related` implementation. Auto-rebuild if `index.json` missing or older than newest `*.md`. |
| `src/commands/relateInstructions.ts` | Prints `RELATE_SPEC.md`. Reuses refactored `locateSpec`. |
| `src/util/locateSpec.ts` | Refactored from `instructions.ts`, takes a filename. |
| `RELATE_SPEC.md` | The relate workflow spec (outlined above). |

## Files to modify

| Path | Change |
|---|---|
| `src/cli.ts` | Register `index`, `related <note-path>`, `relate-instructions`. Bump version `0.2.0`. |
| `src/commands/instructions.ts` | Use the refactored `locateSpec` helper. |
| `src/commands/doctor.ts` | Passive check: does `~/.cache/playlist-to-brain/transformers/Xenova/all-MiniLM-L6-v2/` exist? Print `OK` or `not yet downloaded (will fetch on first 'index' run)`. Non-fatal, no auto-download. |
| `package.json` | Add `"@xenova/transformers": "^2.17"`. Add `"RELATE_SPEC.md"` to `files`. Bump version. |
| `AGENTS_SPEC.md` | Append carve-out to "What not to do": _"Do not edit existing notes — except the `relate` workflow defined in `RELATE_SPEC.md`, which may insert exactly one `## Related` section between `## Open Questions` and `## Transcript`."_ |
| `templates/vault-Inbox-agent.md` | Add new trigger section: _"When the user says 'find related notes' / 'relate the last run' / 'add related links' → run `playlist-to-brain relate-instructions` and follow the spec verbatim."_ Add `relate-instructions`, `related <note-path>`, `index` to "Tools you may use". |
| `README.md` | New section between "Use" and "Long videos" describing the relate flow + `~/.cache/playlist-to-brain/` model location. |

## Edge cases that matter

| Case | Handling |
|---|---|
| Note has no `## Summary` (older note) | Indexer falls back to first non-empty body paragraph, ≤800 chars. `related` queries on such targets return empty + stderr note `target has no embeddable content`. |
| Note has no frontmatter | `fm = {}`, title from H1/filename, empty tags. Still indexable. |
| Note shorter than ~30 chars total | Index but log; consumer can filter `score < 0.2`. |
| `## Related` already present in target | Excluded from `buildEmbeddingText` (it's a navigation artifact). Spec marks the row `skipped` reason `already-related`. |
| Empty index (vault < 2 notes) | `related` returns `[]`; spec marks `skipped` reason `empty-index`. |
| Two notes with same title | CLI returns both with distinct paths; spec instructs agent to use `[[path|Display]]`. |
| Stale index mid-run | `related` auto-rebuilds if any `*.md` mtime > `index.json` mtime. |
| Insertion verification fails | Restore in-memory backup, mark `failed`, continue. |

## Token economics (500-note vault, 10 new notes)

- **Index cold build:** local, zero LLM tokens. ~30–90s on M1/M2.
- **Index warm update:** seconds.
- **Per-note relate call:** ~750 tokens candidates + ~250 tokens target summary + ~100 tokens output → **~$0.005 Sonnet, ~$0.025 Opus**.
- **Whole 10-note run:** ~$0.05 Sonnet / ~$0.25 Opus.
- **Naive baseline (full-vault per note):** ~1M tokens/run. ~100× more.

## Verification

1. `playlist-to-brain doctor` → all green; cache check shows model status.
2. Hand-create a 5-note vault with 2 obvious clusters (3 psych + 2 programming).
3. `playlist-to-brain index` → `index.json` created, 5 entries, `dim: 384`.
4. `playlist-to-brain related ./psych-1.md --limit 4` → other 2 psych notes rank above the 2 programming notes.
5. Modify one note, re-run `index` → only that entry's `mtime` advances.
6. Delete a note, re-run `index` → pruned.
7. Run a real 3-video playlist to completion. Then in the same agent session: _"find related notes"_. Expect 3 notes get `## Related` sections, sidecar `relate-<id>.md` shows 3 `done`.
8. Re-run the relate flow → all 3 marked `skipped` reason `already-related`.
9. Hand-create a note with no `## Summary` → indexer accepts it (fallback paragraph), `related <that-path>` returns `[]`.
10. `playlist-to-brain index --force` → all entries re-embedded.
11. Open one updated note in Obsidian → backlinks appear in the graph; `[[wikilinks]]` resolve.

## Out of scope

- Auto-applying related links without an LLM in the loop (the value-add is the *reason text* + relevance filtering — pure cosine produces noisy related sections, the exact failure mode this design exists to avoid).
- Whole-vault backfill (deferred — same machinery works, just point at a synthetic progress file).
- Embedding model swap UI (changing the `model` field in `index.json` already invalidates and rebuilds).
