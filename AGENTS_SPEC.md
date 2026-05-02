# AGENTS_SPEC — playlist-to-brain

You are running inside an Obsidian vault's `Inbox/` folder. Your job is to convert every video in a YouTube playlist into one atomic Zettelkasten note in the current directory.

## Tools

You only have these primitives (all read-only / stdout-only — none touch the vault):

- `playlist-to-brain list <playlist-url>` → JSON array of `{videoId, title, channelTitle, channelDescription, url, isShort, uploadDate}`.
- `playlist-to-brain meta <videoId>` → JSON `{title, channelTitle, channelDescription, uploadDate, isShort}`.
- `playlist-to-brain transcript <videoId>` → cleaned, punctuated paragraphs to stdout (no timestamps). Auto-captions first; falls back to local whisper.
- Your own file read/write tools for the vault.

Do not invent flags. Do not call any other CLI.

## Workflow

1. Run `playlist-to-brain list <url>`. Parse JSON.
2. Read every `*.md` in the current directory. Collect existing `videoId` values from YAML frontmatter.
3. For each video already present, print one line: `<videoId> already in <file> — skipping`. Remove from the queue.
4. Read `tags.md` if it exists. If present, treat it as the preferred tag vocabulary (bias toward it where reasonable). If absent, print one line: `no tags.md found, choosing tags freely`.
5. For each remaining video, in order:
   1. `playlist-to-brain meta <videoId>` — apply the **author rule**.
   2. `playlist-to-brain transcript <videoId>` — capture stdout as the transcript body.
   3. Compose the note (template below).
   4. Write `<slug>.md`. On filename collision append ` 2`, ` 3`, etc.
   5. Read the file back and verify the YAML parses (no trailing colons, quoted strings where needed).
6. Do not write any state file. Do not summarize at the end unless something failed.

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

- Do not write JSON, logs, or state files into the vault — only `.md` notes.
- Do not include timestamps in the transcript.
- Do not invent an `author` if no person can be identified — omit instead.
- Do not ask for confirmation between videos.
- Do not edit existing notes.
