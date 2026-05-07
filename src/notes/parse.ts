import { basename } from "node:path";

export interface Frontmatter {
  fm: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): Frontmatter {
  const stripped = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const match = stripped.match(FRONTMATTER_RE);
  if (!match) return { fm: {}, body: stripped };

  const yaml = match[1];
  const body = stripped.slice(match[0].length);
  const fm = parseSimpleYaml(yaml);
  return { fm, body };
}

// A deliberately-tiny YAML reader: enough for the note frontmatter shape we
// emit (scalars + flow arrays). Anything fancier should bring in `js-yaml`,
// but it isn't worth a dep for this surface area.
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    out[key] = parseScalar(rawValue);
  }
  return out;
}

function parseScalar(v: string): unknown {
  const s = v.trim();
  if (s === "") return "";
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((x) => unquote(x.trim()));
  }
  return unquote(s);
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// Section ends at the next `## ` heading (any level-2) or EOF. Returns the
// content with leading/trailing whitespace trimmed; null if the heading is
// not present.
export function extractSection(body: string, heading: string): string | null {
  const headingRe = new RegExp(
    `^##\\s+${escapeRegex(heading)}\\s*$`,
    "m",
  );
  const start = body.search(headingRe);
  if (start === -1) return null;

  const afterHeading = body.indexOf("\n", start);
  if (afterHeading === -1) return "";

  const rest = body.slice(afterHeading + 1);
  const nextHeading = rest.search(/^##\s+/m);
  const content = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return content.trim();
}

export function hasSection(body: string, heading: string): boolean {
  return extractSection(body, heading) !== null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractTitle(filePath: string, body: string): string {
  const h1 = body.match(/^#\s+(.+?)\s*$/m);
  if (h1) return h1[1].trim();
  return basename(filePath, ".md");
}

// Pulls the first non-empty paragraph from the body — used as a fallback when
// `## Summary` is absent (older or hand-written notes).
export function firstParagraph(body: string, maxChars = 800): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const firstHeading = trimmed.search(/^##\s+/m);
  const slice = firstHeading === -1 ? trimmed : trimmed.slice(0, firstHeading);
  const para = slice.split(/\n{2,}/).find((p) => p.trim().length > 0) ?? "";
  return para.trim().slice(0, maxChars);
}

export function extractTakeaways(body: string): string[] {
  const section = extractSection(body, "Key Takeaways");
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

export function extractTags(fm: Record<string, unknown>): string[] {
  const v = fm.tags;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return [v];
  return [];
}

export function extractAuthor(fm: Record<string, unknown>): string | null {
  const v = fm.author;
  if (typeof v === "string" && v) return v;
  return null;
}

export interface NoteFacets {
  title: string;
  tags: string[];
  author: string | null;
  summary: string;
  takeaways: string[];
}

export function extractFacets(filePath: string, raw: string): NoteFacets {
  const { fm, body } = parseFrontmatter(raw);
  const title = extractTitle(filePath, body);
  const tags = extractTags(fm);
  const author = extractAuthor(fm);
  const summary =
    extractSection(body, "Summary") ?? firstParagraph(stripRelated(body));
  const takeaways = extractTakeaways(body);
  return { title, tags, author, summary, takeaways };
}

// `## Related` is a navigation artifact — exclude it from anything we embed
// or summarize so the relationships graph doesn't reinforce itself.
export function stripRelated(body: string): string {
  const re = /^##\s+Related\s*$[\s\S]*?(?=^##\s+|\Z)/m;
  return body.replace(re, "");
}

export function buildEmbeddingText(f: NoteFacets, maxChars = 2000): string {
  const parts: string[] = [];
  parts.push(f.title);
  if (f.tags.length) parts.push(`tags: ${f.tags.join(", ")}`);
  if (f.author) parts.push(`author: ${f.author}`);
  if (f.summary) parts.push(f.summary);
  if (f.takeaways.length) parts.push(f.takeaways.map((t) => `- ${t}`).join("\n"));
  return parts.join("\n\n").slice(0, maxChars);
}

export function summaryForOutput(summary: string, maxChars = 500): string {
  if (summary.length <= maxChars) return summary;
  return summary.slice(0, maxChars).trimEnd();
}
