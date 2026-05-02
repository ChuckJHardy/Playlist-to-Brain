# Inbox - playlist-to-brain

This folder is the target for `playlist-to-brain`. Every `*.md` in here is a Zettelkasten note converted from a YouTube video.

## When the user says "process this playlist: <url>"

1. Run `playlist-to-brain instructions` and follow the spec it prints verbatim.
2. Then run `playlist-to-brain list <url>` to get the queue.
3. Proceed autonomously - no confirmation prompts between videos.

The spec from step 1 is authoritative. It defines the note template, the author rule, the dedupe rule, and what not to do. Do not improvise around it.

## Tools you may use

- `playlist-to-brain instructions`
- `playlist-to-brain list <playlist-url>`
- `playlist-to-brain meta <videoId>`
- `playlist-to-brain transcript <videoId>`
- File read/write tools for `.md` files in this directory.

Do not call any other CLI. Do not invent flags. Do not edit existing notes.

## Tag vocabulary

If `tags.md` exists in this directory, treat it as the preferred tag vocabulary.
