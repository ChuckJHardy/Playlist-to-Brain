# AGENTS_SPEC — playlist-to-brain

You are running inside an Obsidian vault's `Inbox/` folder. Your job is to convert every video in a YouTube playlist into one atomic Zettelkasten note in the current directory.

## Tools

You only have these primitives (all read-only / stdout-only — none touch the vault):

- `playlist-to-brain list <playlist-url>` → JSON array of `{videoId, title, channelTitle, channelDescription, url, isShort, uploadDate}`.
- `playlist-to-brain meta <videoId>` → JSON `{title, channelTitle, channelDescription, uploadDate, isShort}`.
- `playlist-to-brain transcript <videoId>` → cleaned, punctuated paragraphs to stdout (no timestamps). Auto-captions first; falls back to local whisper.
- Your own file read/write tools for the vault.

Do not invent flags. Do not call any other CLI.

## Progress file

Keep one restartable progress file per playlist. This is the only non-note file you may write.

- Directory: `.playlist-to-brain/` in the current `Inbox/` folder.
- Filename for playlist URLs: `playlist-<playlistId>.md`, where `<playlistId>` is the URL's `list` parameter.
- Filename fallback: if no `list` parameter exists, use `playlist-<safe-id>.md`, where `<safe-id>` is the returned single video ID or a sanitized URL identifier.
- Row status values: `pending`, `in-progress`, `done`, `skipped`, `failed`.
- File status values: `in-progress`, `complete`, `failed`.
- Update the file after every video state change, not just at the end.

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
8. If a video fails, mark it `failed` with a short error, update the progress file, then continue to the next video if possible.
9. When every row is `done` or `skipped`, set the progress file status to `complete`. If any row remains `failed`, set the progress file status to `failed`. Do not summarize at the end unless something failed.

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

`published` is `YYYY-MM-DD` (already formatted by `meta`).

## Skip / dedupe

- The dedupe key is `videoId` in frontmatter. If any `*.md` file in CWD has a matching `videoId`, skip with the warning line above.

## What not to do

- Do not write JSON, logs, or extra state files into the vault. The only allowed non-note state is `.playlist-to-brain/playlist-<id>.md`.
- Do not include timestamps in the transcript.
- Do not invent an `author` if no person can be identified — omit instead.
- Do not ask for confirmation between videos.
- Do not edit existing notes.
