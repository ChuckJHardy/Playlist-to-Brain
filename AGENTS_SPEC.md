# AGENTS_SPEC — playlist-to-brain

You are running inside an Obsidian vault's `Inbox/` folder. Your job is to convert every video in a YouTube playlist — or a single YouTube video — into one atomic Zettelkasten note in the current directory.

The input may be:

- a playlist URL like `https://www.youtube.com/playlist?list=PL...`
- a single-video URL like `https://www.youtube.com/watch?v=<videoId>`, `https://youtu.be/<videoId>`, or `https://www.youtube.com/shorts/<videoId>`

`playlist-to-brain list <url>` works for both. For single-video URLs the queue is one row; the rest of the workflow is identical.

## Tools

You only have these primitives (all read-only / stdout-only — none touch the vault):

- `playlist-to-brain list <playlist-url>` → JSON array of `{videoId, title, channelTitle, channelDescription, url, isShort, uploadDate}`.
- `playlist-to-brain meta <videoId>` → JSON `{title, channelTitle, channelDescription, uploadDate, isShort}`.
- `playlist-to-brain transcript <videoId>` → cleaned, punctuated paragraphs to stdout (no timestamps). Auto-captions first; falls back to local whisper.
- Your own file read/write tools for the vault.

Do not invent flags. Do not call any other CLI.

## Progress file

Keep one restartable progress file per run. This is the only non-note file you may write.

- Directory: `.playlist-to-brain/` in the current `Inbox/` folder.
- Filename for playlist URLs: `playlist-<playlistId>.md`, where `<playlistId>` is the URL's `list` parameter.
- Filename for single-video URLs: `playlist-<videoId>.md`, where `<videoId>` is the `videoId` field of the single entry returned by `playlist-to-brain list <url>`. Set `playlistId: <videoId>` and `playlistUrl: <original-url>` in the file header. The shape and workflow are otherwise identical to a one-row playlist.
- Filename fallback for anything else: `playlist-<safe-id>.md`, where `<safe-id>` is a sanitized URL identifier.
- Row status values: `pending`, `in-progress`, `done`, `skipped`, `failed`.
- File status values: `in-progress`, `complete`, `failed`.
- Update the file after every video state change, not just at the end.

`skipped` covers two cases: a note for that `videoId` already exists, **or** the video cannot be processed for a reason that retrying will not fix (e.g. an LLM provider rejects the transcript with a content-filtering / policy error such as `400 invalid_request_error: Output blocked by content filtering policy`, the video is private/removed, or the transcript is empty after both auto-captions and whisper). Record the reason in the `error` column and continue to the next video — do not let a single skip block the queue.

`failed` is for transient or unclear errors that may succeed on retry (network blips, timeouts, unexpected exceptions). Skips do not flip the file status to `failed`; only `failed` rows do.

Progress file template:

```markdown
# Playlist Processing Progress

playlistUrl: https://www.youtube.com/playlist?list=PL...
playlistId: PL...
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: in-progress

## Queue

| # | videoId | title | status | note | updated | error |
|---|---|---|---|---|---|---|
| 1 | abc123 | Example title | pending |  | YYYY-MM-DD |  |
```

Escape `|` characters in titles and errors as `/` so the table stays readable.

## Workflow

1. Run `playlist-to-brain list <url>`. Parse JSON.
2. Determine the progress path, then read the progress file if it already exists.
3. Read every `*.md` in the current directory except files under `.playlist-to-brain/`. Collect existing `videoId` values from YAML frontmatter.
4. If the progress file did not exist, initialize it with every playlist item in order:
   - Mark rows with an existing note as `skipped`, record the note filename, and print `<videoId> already in <file> — skipping`.
   - Mark all other rows `pending`.
   - Write the progress file before processing starts.
5. If the progress file already existed, reconcile it with the current playlist and notes:
   - If the playlist contains videos not yet listed in the progress file, append them as `pending` rows in playlist order.
   - If any listed video already has a note, mark it `done`, record the note filename, print `<videoId> already in <file> — skipping`, and remove it from the active queue.
   - If a row is `done` or `skipped` but the note is missing, downgrade that row to `pending`.
   - If a row is `in-progress`, retry that video unless a note now exists for its `videoId`.
   - Keep `failed` rows in the file. Retry them after pending rows unless the failure clearly cannot be retried.
6. Read `tags.md` if it exists. If present, treat it as the preferred tag vocabulary (bias toward it where reasonable). If absent, print one line: `no tags.md found, choosing tags freely`.
7. Process unfinished rows in this order: `pending` and `in-progress` rows in playlist order, then retriable `failed` rows in playlist order. For each row:
   1. Mark the row `in-progress` and update the file.
   2. `playlist-to-brain meta <videoId>` — apply the **author rule**.
   3. `playlist-to-brain transcript <videoId>` — capture stdout as the transcript body.
   4. Compose the note (template below).
   5. Write `<slug>.md`. On filename collision append ` 2`, ` 3`, etc.
   6. Read the file back and verify the YAML parses (no trailing colons, quoted strings where needed).
   7. Mark the row `done`, record the note filename, clear any error, and update the file.
8. If a video fails, decide which bucket it falls into and update the progress file, then continue to the next video:
   - **Non-retriable** (content-policy rejection from the LLM, private/removed video, empty transcript after both fallbacks): mark `skipped` with a short error.
   - **Retriable** (network, timeout, unknown): mark `failed` with a short error.
   Never abort the run because of a single video — keep going until the queue is empty.
9. When every row is `done` or `skipped`, set the progress file status to `complete`. If any row remains `failed`, set the progress file status to `failed`.
10. At the end of the run, always print one line with the final counts:

    ```
    playlist-to-brain: done=<n> skipped=<n> failed=<n> pending=<n>
    ```

    Count every row in the progress file. `pending` should normally be `0`; a non-zero value means the run was interrupted before the queue was drained.

Run autonomously — no confirmation prompts.

## Author rule

`author` must point at a person, wrapped as `[[Name]]`.

1. If the channel reads as a person (channel title + description suggest an individual, judged by you), use the channel title: `author: "[[Channel Title]]"`.
2. Else, if the channel is an organization (e.g. "TED", "Y Combinator") and the video title contains a speaker (e.g. `"Chase Hughes: How to..."`, `"Jane Doe on X"`), extract that name: `author: "[[Chase Hughes]]"`.
3. Else, **omit the `author` field entirely**. Never write a partial or org-as-author. Do not skip the video.

## Tag rule

- Pick 2–5 tags. Prefer existing entries from `tags.md` when reasonable.
- If a video clearly needs a new tag, you may invent one — keep it lowercase, kebab-case, single concept.

## Title / slug

- Title style: whatever fits the video — concise and meaningful.
- Slug: kebab-case from the title; trim YouTube clickbait fluff.
- Filename collisions append ` 2`, ` 3`, etc.

## Source URL

- Strip `?si=...` and any other share-tracking params.
- Shorts use `https://www.youtube.com/shorts/<id>`. Regular videos use `https://www.youtube.com/watch?v=<id>`. The `meta` and `list` outputs include `isShort` and `url` already in the right form.

## Long videos

Some videos are long enough that the full transcript may not fit comfortably alongside your reasoning in your context window. The CLI cannot switch your model for you, so this is your responsibility.

1. After `meta <id>`, look at `duration` (seconds). After `transcript <id>`, measure the character count of stdout.
2. Use **your own judgment** about whether the transcript is "long" relative to your context window. There are no hard thresholds in this spec — what overflows a small model is fine on a 1M-context model.
3. If you judge the video to be long, **before writing the note, print one line to the user** stating the duration in minutes and the transcript size in characters, and recommend they restart in a higher-context-window model (e.g. Claude with 1M context) for best fidelity. Then continue with the single-pass note attempt.
4. If your single-pass LLM call fails because the input is too large or you run out of context, **fall back to chunked summarization** — do not abort the video:
   - Split the cleaned transcript into roughly-equal chunks (your judgment, typically 3–6).
   - Summarize each chunk into a short paragraph plus 2–4 takeaways.
   - Synthesize the final `## Summary`, `## Key Takeaways`, and `## Open Questions` sections from the per-chunk summaries.
   - The full cleaned transcript still goes into `## Transcript` unmodified.
   - Record `chunked` in the `note` column of the progress file row (e.g. `<filename> (chunked)`) so the run is traceable.
5. If even chunked summarization fails for context reasons, mark the row `failed` with a short error mentioning context overflow and suggesting a higher-context model. This is retriable on a larger model.

## Markdown formatting

Every note must follow these rules — they are not stylistic preferences, they are required:

- `---` is reserved for YAML frontmatter delimiters at the top of the file. Do not use it as a horizontal rule or section separator anywhere else in the note.
- Every heading (`#`, `##`, `###`, ...) is followed by a blank line before the next content.
- No consecutive blank lines — collapse to a single blank line between blocks.
- The file ends with exactly one trailing newline.
- Bullet lists use `-` (not `*` or `+`) with a single space after the marker.
- Emphasis uses `_italic_`; strong uses `**bold**`.
- Fenced code blocks use triple backticks with a language tag when known.

When you read the note back to verify YAML, also verify the body still satisfies these rules.

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

## Transcript

Cleaned, punctuated paragraphs. No timestamps.
```

`published` is `YYYY-MM-DD` (already formatted by `meta`). Note: there is **no** `---` separator before `## Transcript` — section headings alone delimit sections.

## Skip / dedupe

- The dedupe key is `videoId` in frontmatter. If any `*.md` file in CWD has a matching `videoId`, skip with the warning line above.

## What not to do

- Do not write JSON, logs, or extra state files into the vault. The only allowed non-note state is `.playlist-to-brain/playlist-<id>.md` (and `.playlist-to-brain/relate-<id>.md` / `.playlist-to-brain/index.json` produced by the relate workflow).
- Do not include timestamps in the transcript.
- Do not invent an `author` if no person can be identified — omit instead.
- Do not ask for confirmation between videos.
- Do not edit existing notes — **except** the `relate` workflow defined in `RELATE_SPEC.md`, which may insert exactly one `## Related` section between `## Open Questions` and `## Transcript`.
