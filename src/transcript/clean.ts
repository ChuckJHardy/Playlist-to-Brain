// Take raw text from VTT or whisper, return cleaned, paragraphed prose.
//
// We do NOT try to do real punctuation restoration here — whisper-cpp
// already produces punctuated text, and YouTube auto-captions do too on
// recent uploads. The job is to:
//  - drop timestamps and cue tags
//  - de-duplicate runs (auto-captions repeat lines as the cue advances)
//  - merge into paragraphs every ~5 sentences

const SENTENCES_PER_PARAGRAPH = 5;

export function cleanText(raw: string): string {
  const stripped = raw
    .replace(/<[^>]+>/g, "") // VTT inline cue tags like <c> or <00:00:01.000>
    .replace(/ /g, " ");
  const lines = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const deduped: string[] = [];
  for (const l of lines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== l) {
      deduped.push(l);
    }
  }

  // Stitch into one stream and split on sentence boundaries.
  const stream = deduped.join(" ").replace(/\s+/g, " ").trim();
  if (!stream) return "";
  const sentences = stream
    .split(/(?<=[.!?])\s+(?=[A-Z"'\(])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" "));
  }
  return paragraphs.join("\n\n");
}
