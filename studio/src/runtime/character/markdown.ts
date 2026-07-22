/**
 * Small, dependency-light Markdown helpers used to extract structured data
 * from the character SDK documents. Kept deliberately narrow: it understands
 * level-1 headings, fenced code blocks and bullet lists — enough for the
 * Mei SDK document conventions.
 */

export interface MarkdownSection {
  /** Heading text without the leading "# " (e.g. "7. Primary traits"). */
  heading: string;
  /** Raw body between this heading and the next level-1 heading. */
  body: string;
}

/** Split a document into level-1 (`# `) sections. */
export function splitSections(md: string): MarkdownSection[] {
  const lines = md.split(/\r?\n/);
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;
  for (const line of lines) {
    const m = /^#\s+(.*)$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1].trim(), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** Find the first section whose heading (case-insensitive) contains `needle`. */
export function findSection(
  sections: MarkdownSection[],
  needle: string
): MarkdownSection | undefined {
  const n = needle.toLowerCase();
  return sections.find((s) => s.heading.toLowerCase().includes(n));
}

/** Extract the contents of fenced code blocks, optionally filtered by language. */
export function fencedBlocks(body: string, lang?: string): string[] {
  const out: string[] = [];
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (lang && match[1].toLowerCase() !== lang.toLowerCase()) continue;
    out.push(match[2].replace(/\s+$/, ""));
  }
  return out;
}

/** Extract bullet list items (`* ` or `- `), trimmed of trailing punctuation. */
export function bulletItems(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[*-]\s+/.test(l))
    .map((l) => l.replace(/^[*-]\s+/, "").replace(/[;.]\s*$/, "").trim())
    .filter((l) => l.length > 0);
}

/** Non-empty, trimmed lines of a text block. */
export function nonEmptyLines(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** First non-empty heading/line of a document, without leading `#`. */
export function firstHeading(md: string): string | null {
  const line = md.split(/\r?\n/).find((l) => l.trim().length > 0);
  return line ? line.replace(/^#+\s*/, "").trim() : null;
}
