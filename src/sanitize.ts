/**
 * src/sanitize.ts
 *
 * The one place untrusted HTML gets sanitized before it's ever allowed to
 * touch `innerHTML`. Enforces the pipeline a security review called for:
 *
 *   Markdown -> Parser (marked) -> Sanitizer (this file) -> Safe HTML -> DOM
 *
 * `marked` intentionally passes raw HTML embedded in Markdown source
 * straight through unchanged - CommonMark/GFM's inline/block HTML is a
 * first-class Markdown feature, not an edge case, and sanitizing the
 * result is documented as the calling application's responsibility (marked
 * dropped its own built-in `sanitize` option in v5 specifically to push
 * this onto a dedicated sanitizer instead). Without this step, a Markdown
 * file containing e.g. `<img src=x onerror="...">` would execute arbitrary
 * script in this app's origin the instant it's rendered - simply opening a
 * shared .md/.docx file, no exploit trickery required.
 *
 * Two call sites need this, both wherever untrusted HTML is first produced
 * rather than only at the final render step - sanitizing late would still
 * leave file-loader.ts's mammoth-derived HTML executing handlers
 * (onerror/onload can fire on elements assigned via innerHTML even before
 * any further processing, regardless of whether that element ever reaches
 * a live, on-screen document):
 *  - markdown.ts's renderMarkdown() - every Markdown render, including
 *    .docx-derived content once it's round-tripped back to Markdown text.
 *  - file-loader.ts's docxToMarkdown() - mammoth's raw docx->HTML output,
 *    before it's ever assigned to an element's innerHTML at all.
 */

import DOMPurify from "dompurify";

/** Sanitize an HTML string, stripping anything capable of executing script
 * (script tags, event handler attributes, javascript: URIs, etc.) while
 * preserving normal structural/formatting markup - DOMPurify's default
 * profile, no custom allowlist needed for what Markdown/docx conversion
 * actually produces (headings, paragraphs, lists, tables, code blocks,
 * links, images, inline formatting). */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
