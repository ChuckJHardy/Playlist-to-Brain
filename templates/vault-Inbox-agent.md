# Inbox - playlist-to-brain

This folder is the target for `playlist-to-brain`. Every `*.md` in here is a Zettelkasten note converted from a YouTube video.

## When the user says "process this <kind>: <url>"

The user may phrase the request as "process this playlist: <url>", "process this video: <url>", or "process this: <url>". The URL itself disambiguates:

- `?list=PL...` → playlist
- `watch?v=<id>`, `youtu.be/<id>`, or `/shorts/<id>` → single video

Either way:

1. Run `playlist-to-brain instructions` and follow the spec it prints verbatim.
2. Then run `playlist-to-brain list <url>` to get the queue. (For a single video the queue is one row.)
3. Create or update the progress file under `.playlist-to-brain/` per the spec's progress-file rules.
4. Proceed autonomously - no confirmation prompts between videos.

The spec from step 1 is authoritative. It defines the note template, the author rule, the dedupe rule, the progress-file rule, the long-video rule, and what not to do. Do not improvise around it.

## When the user says "find related notes" / "relate the last run" / "add related links"

1. Run `playlist-to-brain relate-instructions` and follow the spec it prints verbatim.
2. The spec scopes itself to the most-recently-modified run's notes. It defines its own progress sidecar at `.playlist-to-brain/relate-<id>.md`, so re-runs are idempotent.

This is the only command flow allowed to edit existing notes — and only to insert a `## Related` section between `## Open Questions` and `## Transcript`.

## Tools you may use

- `playlist-to-brain instructions`
- `playlist-to-brain list <playlist-url>`
- `playlist-to-brain meta <videoId>`
- `playlist-to-brain transcript <videoId>`
- `playlist-to-brain relate-instructions`
- `playlist-to-brain related <note-path>`
- `playlist-to-brain index`
- File read/write tools for notes in this directory and progress files under `.playlist-to-brain/`.

Do not call any other CLI. Do not invent flags. Do not edit existing notes — except for the `## Related` insertion described in `RELATE_SPEC.md`.

## Tag vocabulary

If `tags.md` exists in this directory, treat it as the preferred tag vocabulary.
