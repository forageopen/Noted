/**
 * src/markdown.ts
 *
 * Thin wrapper around `marked` so the rest of the app depends on this
 * module's small surface, not directly on the library's API shape.
 */

import { marked, type Token, type Tokens } from "marked";
import { sanitizeHtml } from "./sanitize";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Strips a leading YAML frontmatter block (`---` ... `---`, first line must
 * be exactly `---`) from Markdown source, if present. Frontmatter is
 * internal metadata (doc_id, tags, etc.) meant for tooling, not content a
 * reader wants to see rendered - the pane already shows the file name
 * separately, so the frontmatter block adds nothing when displayed. Returns
 * the source unchanged if it doesn't start with a frontmatter block.
 */
export function stripFrontmatter(source: string): string {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return source;

  const closingIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (closingIndex === -1) return source;

  let contentStart = closingIndex + 1;
  while (contentStart < lines.length && lines[contentStart]?.trim() === "") contentStart++;

  return lines.slice(contentStart).join("\n");
}

/** Render Markdown source to a sanitized HTML string (synchronous). `marked`
 * passes raw HTML embedded in the source straight through unchanged - see
 * sanitize.ts's header comment for why the sanitize step here is not
 * optional. */
export function renderMarkdown(source: string): string {
  const out = marked.parse(source, { async: false });
  if (typeof out !== "string") {
    throw new Error("marked.parse returned a Promise; async mode is not used here");
  }
  return sanitizeHtml(out);
}

/** Lex Markdown source into marked's token tree, for structural export (docx). */
export function lexMarkdown(source: string): Token[] {
  return marked.lexer(source);
}

export type { Token, Tokens };
