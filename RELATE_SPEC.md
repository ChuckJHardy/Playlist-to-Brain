# RELATE_SPEC — playlist-to-brain `relate` workflow

You are running inside an Obsidian vault's `Inbox/` folder. Your job is to walk the notes that the most recent `playlist-to-brain` run produced and add a `## Related` section to each, listing 3–5 wikilinks to other notes in the vault with a one-sentence reason for each.

This is the **only** workflow allowed to edit existing notes. `AGENTS_SPEC.md`'s "do not edit existing notes" rule still applies everywhere else. Within this workflow you may insert exactly one `## Related` section between `## Open Questions` and `## Transcript`. You must not touch frontmatter, `## Summary`, `## Key Takeaways`, `## Open Questions`, `## Transcript`, or any other section.

## Tools

- `playlist-to-brain relate-instructions` — prints this spec.
- `playlist-to-brain index [--force] [--root <dir>] [--quiet]` — builds or refreshes `.playlist-to-brain/index.json`. `related` auto-rebuilds when stale; you rarely need to call this directly.
- `playlist-to-brain related <note-path> [--limit 15] [--root <dir>]` — returns a JSON array of top-K candidate notes with their summaries and takeaways pre-populated. The agent reads this directly; it does not need to open the candidate files.
- Your own file read/write tools for the notes in this directory and the relate-progress sidecar under `.playlist-to-brain/`.

Do not invent flags. Do not call any other CLI.

## `related` output shape

```json
[
  {
    "path": "Inbox/some-note.md",
    "title": "Some Note",
    "tags": ["psychology","habits"],
    "author": "[[Jane Doe]]",
    "summary": "First 500 chars of the candidate's ## Summary…",
    "takeaways": ["bullet 1","bullet 2"],
    "score": 0.812
  }
]
```

The `score` is cosine similarity in [0, 1]. Treat it as a hint, not a verdict — drop high-score matches whose summary is irrelevant. Soft floor: ~0.35. Below that, candidates are usually noise.

## Sidecar progress file

For every relate run, keep one restartable sidecar.

- Directory: `.playlist-to-brain/` in the current `Inbox/` folder.
- Filename: `relate-<id>.md` where `<id>` matches the source playlist progress file (e.g. `playlist-PL123.md` ↔ `relate-PL123.md`).
- Row status values: `pending`, `in-progress`, `done`, `skipped`, `failed`.
- File status values: `in-progress`, `complete`, `failed`.
- Update the file after every per-note state change, not just at the end.

Sidecar template:

```markdown
# Relate Progress

sourceProgress: .playlist-to-brain/playlist-PL123.md
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: in-progress

## Queue

| # | note | status | reason | updated | error |
|---|---|---|---|---|---|
| 1 | atomic-habits-overview.md | pending |  | YYYY-MM-DD |  |
```

Escape `|` characters in any free-text column as `/` so the table stays readable.

`skipped` covers cases that retrying will not fix:

- `already-related` — note already has a `## Related` section.
- `no-summary` — note has no `## Summary` and no usable fallback paragraph.
- `empty-index` — the vault has fewer than two notes.

`failed` is for transient or unclear errors that may succeed on retry (file-write failures, verification failures, unknown). Skips do not flip the file status to `failed`; only `failed` rows do.

## Workflow

1. **Locate the source run.** List `.playlist-to-brain/playlist-*.md` (excluding `relate-*.md`). Sort by mtime descending. The first entry is the source. If none exist, print `no playlist progress files found — run a playlist first` and exit.
2. **Read the source.** Parse its queue table; collect rows where `status == done` and the `note` column is non-empty. These are the notes you will process. (Rows with status `skipped` are deliberately not processed — those notes already existed before this run.)
3. **Open or create the sidecar** at `.playlist-to-brain/relate-<id>.md` (the same `<id>` as the source). If it exists, reconcile:
   - For each note from step 2, ensure a row exists; append if missing as `pending`.
   - Keep `done`/`skipped` rows as-is (idempotent re-runs).
   - Retry `failed` rows after pending rows.
   - Set the file `status: in-progress` and `updated:` to today.
4. **Process unfinished rows in order.** For each `pending`/`in-progress`/`failed` row:
   1. Mark the row `in-progress` and update the sidecar.
   2. Read the note from the path in the row (relative to the Inbox folder).
   3. If the body matches `^## Related\b` (line-anchored), mark `skipped` reason `already-related`. Continue.
   4. If the note has no `## Summary` section AND no usable fallback paragraph, mark `skipped` reason `no-summary`. Continue.
   5. Run `playlist-to-brain related <abs-path> --limit 15`. Parse JSON. If empty, mark `skipped` reason `empty-index`. Continue.
   6. Pick 3–5 candidates by **content reasoning**, not score alone. Drop any whose summary is unrelated even if `score` is high. Aim for cosine ≥ 0.35 as a soft floor.
   7. Compose the block. Use this exact shape — it must satisfy the Markdown formatting rules in `AGENTS_SPEC.md`:

      ```markdown
      ## Related

      - [[Other Note]] — _one-sentence reason._
      - [[Another Note]] — _another reason._
      ```

      Rules:

      - Use `-` bullets with a single space after.
      - The reason is wrapped in `_…_` (italic) and is one sentence ending with a period.
      - Blank line after the heading.
      - The reference uses the candidate's `title` field. If two candidates in the JSON share the same `title`, disambiguate with the path form `[[<path-without-extension>|<title>]]` for both.
   8. **Insert** the block between `## Open Questions` and `## Transcript`:
      - Find the line index of `## Open Questions` and `## Transcript` (line-anchored, `^## Heading\s*$`).
      - **Both present:** insert the block immediately before `## Transcript`. There must be exactly one blank line above `## Related` and exactly one blank line between `## Related` and `## Transcript`.
      - **Only `## Transcript` present:** insert the block immediately before `## Transcript` with the same blank-line padding.
      - **Only `## Open Questions` present:** append the block at EOF after the existing content. Note this case in the row's `reason` column.
      - **Neither present:** append at EOF.
      - After insertion: collapse runs of 3+ newlines down to 2; ensure exactly one trailing newline.
   9. Read the file back. Verify:
      - The frontmatter still parses (no broken YAML).
      - Exactly one `^## Related` line exists.
      - Markdown rules from `AGENTS_SPEC.md` "Markdown formatting" still hold (no consecutive blank lines, `-` bullets, blank line after headings, single trailing newline).

      If verification fails, restore the file from the in-memory copy you read in step 4.2 and mark the row `failed` with a short error.
   10. Mark the row `done`, record a short reason (e.g. `inserted 4 links`), clear any error, and update the sidecar.
5. When every row is `done` or `skipped`, set the sidecar status to `complete`. If any row remains `failed`, set the sidecar status to `failed`.
6. **End of run** — print one line:

   ```
   playlist-to-brain relate: done=<n> skipped=<n> failed=<n> pending=<n>
   ```

Run autonomously — no confirmation prompts.

## What not to do

- Do not edit any section of any note other than to insert one `## Related` block.
- Do not modify frontmatter.
- Do not call `playlist-to-brain index --force` unless the user explicitly asks; the auto-rebuild on stale is sufficient.
- Do not write JSON, logs, or extra state files into the vault. The only allowed non-note state is `.playlist-to-brain/relate-<id>.md`.
- Do not pick more than 5 related links per note. If fewer than 3 truly fit, prefer fewer over filler.
