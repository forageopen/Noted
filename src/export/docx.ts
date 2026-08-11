/**
 * src/export/docx.ts
 *
 * .docx export via the `docx` package.
 *
 * Two ways a Pane's content can reach this exporter:
 *  1. Fresh from a loaded file, never touched in the Edit tab: we still
 *     have the original Markdown text, so we build the docx structure
 *     from `marked.lexer()`'s token tree (`tokensToBlocks`) - per
 *     PRODUCT-SPEC.md Section 3, this avoids trying to reverse-engineer
 *     structure out of rendered HTML.
 *  2. Edited in the Edit tab: the Edit tab is a contenteditable region
 *     (see src/pane.ts for why HTML, not Markdown, is that tab's source
 *     of truth), so there is no Markdown text for the edited result -
 *     `execCommand` mutates HTML directly. For this path we walk the
 *     live contenteditable DOM instead (`elementToBlocks`).
 *
 * Both paths converge on the same intermediate representation
 * (`DocxBlock[]` / `DocxRun[]`), and exactly one function
 * (`blocksToDocxElements`) turns that IR into actual `docx` package
 * objects. So there is a single place that maps "heading / paragraph /
 * bold / italic / list" semantics onto docx.js constructs, regardless of
 * which of the two paths produced the IR.
 */

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { Token, Tokens } from "../markdown";

export interface DocxRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: string;
}

export type DocxBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: DocxRun[] }
  | { kind: "paragraph"; runs: DocxRun[] }
  | { kind: "listItem"; ordered: boolean; runs: DocxRun[] };

// ---------------------------------------------------------------------
// Path 1: Markdown token tree (marked.lexer output) -> DocxBlock[]
// ---------------------------------------------------------------------

/** Pure: convert marked's token tree into our docx-agnostic IR. */
export function tokensToBlocks(tokens: Token[]): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  for (const token of tokens) {
    appendTokenBlocks(token, blocks);
  }
  return blocks;
}

function appendTokenBlocks(token: Token, blocks: DocxBlock[]): void {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const level = Math.min(6, Math.max(1, heading.depth)) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: "heading", level, runs: inlineTokensToRuns(heading.tokens ?? []) });
      break;
    }
    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      blocks.push({ kind: "paragraph", runs: inlineTokensToRuns(paragraph.tokens ?? []) });
      break;
    }
    case "list": {
      const list = token as Tokens.List;
      for (const item of list.items) {
        const runs = inlineTokensToRuns(flattenListItemInline(item));
        blocks.push({ kind: "listItem", ordered: list.ordered === true, runs });
      }
      break;
    }
    case "blockquote": {
      const blockquote = token as Tokens.Blockquote;
      for (const inner of blockquote.tokens ?? []) {
        appendTokenBlocks(inner, blocks);
      }
      break;
    }
    case "space":
      break;
    default: {
      // Fallback: render anything else (code blocks, hr, html, etc.) as a
      // plain paragraph of its raw text so nothing silently disappears.
      const text = "text" in token && typeof token.text === "string" ? token.text : token.raw;
      if (text && text.trim().length > 0) {
        blocks.push({ kind: "paragraph", runs: [{ text }] });
      }
    }
  }
}

function flattenListItemInline(item: Tokens.ListItem): Token[] {
  const inline: Token[] = [];
  for (const child of item.tokens ?? []) {
    if (child.type === "text" && "tokens" in child && child.tokens) {
      inline.push(...child.tokens);
    } else if (child.type === "text") {
      inline.push(child);
    }
    // Nested lists/paragraphs inside list items are skipped for v1's
    // "basic fidelity" bar - flattening to the item's own text is enough.
  }
  return inline;
}

function inlineTokensToRuns(tokens: Token[], formatting: Partial<DocxRun> = {}): DocxRun[] {
  const runs: DocxRun[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "strong":
        runs.push(...inlineTokensToRuns((token as Tokens.Strong).tokens, { ...formatting, bold: true }));
        break;
      case "em":
        runs.push(...inlineTokensToRuns((token as Tokens.Em).tokens, { ...formatting, italics: true }));
        break;
      case "del":
        runs.push(...inlineTokensToRuns((token as Tokens.Del).tokens, { ...formatting, strike: true }));
        break;
      case "codespan":
        runs.push({ ...formatting, text: (token as Tokens.Codespan).text });
        break;
      case "link":
        runs.push(...inlineTokensToRuns((token as Tokens.Link).tokens, formatting));
        break;
      case "text": {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          runs.push(...inlineTokensToRuns(textToken.tokens, formatting));
        } else {
          runs.push({ ...formatting, text: textToken.text });
        }
        break;
      }
      case "br":
        runs.push({ ...formatting, text: "\n" });
        break;
      default: {
        if ("text" in token && typeof token.text === "string") {
          runs.push({ ...formatting, text: token.text });
        }
      }
    }
  }
  return runs;
}

// ---------------------------------------------------------------------
// Path 2: live contenteditable DOM -> DocxBlock[]
// ---------------------------------------------------------------------

const HEADING_TAGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

/** Pure(ish - takes a detached-safe DOM element): walk edited HTML into IR. */
export function elementToBlocks(root: Element): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  for (const child of Array.from(root.children)) {
    appendElementBlocks(child, blocks);
  }
  // Root has no element children (e.g. plain text was typed directly) -
  // treat the whole thing as one paragraph.
  if (blocks.length === 0 && (root.textContent ?? "").trim().length > 0) {
    blocks.push({ kind: "paragraph", runs: elementInlineRuns(root, {}) });
  }
  return blocks;
}

function appendElementBlocks(el: Element, blocks: DocxBlock[]): void {
  const tag = el.tagName;
  if (tag in HEADING_TAGS) {
    blocks.push({ kind: "heading", level: HEADING_TAGS[tag]!, runs: elementInlineRuns(el, {}) });
    return;
  }
  if (tag === "P" || tag === "DIV") {
    const runs = elementInlineRuns(el, {});
    if (runs.some((r) => r.text.trim().length > 0)) {
      blocks.push({ kind: "paragraph", runs });
    }
    return;
  }
  if (tag === "BLOCKQUOTE") {
    for (const child of Array.from(el.children)) {
      appendElementBlocks(child, blocks);
    }
    return;
  }
  if (tag === "UL" || tag === "OL") {
    const ordered = tag === "OL";
    for (const li of Array.from(el.children)) {
      if (li.tagName !== "LI") continue;
      blocks.push({ kind: "listItem", ordered, runs: elementInlineRuns(li, {}) });
    }
    return;
  }
  // Unknown block-level wrapper: recurse into its children.
  if (el.children.length > 0) {
    for (const child of Array.from(el.children)) {
      appendElementBlocks(child, blocks);
    }
  } else {
    const text = el.textContent ?? "";
    if (text.trim().length > 0) {
      blocks.push({ kind: "paragraph", runs: [{ text }] });
    }
  }
}

function elementInlineRuns(el: Element, formatting: Partial<DocxRun>): DocxRun[] {
  const runs: DocxRun[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const text = node.textContent ?? "";
      if (text.length > 0) runs.push({ ...formatting, text });
      continue;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;
    const child = node as Element;
    const next: Partial<DocxRun> = { ...formatting };
    const tag = child.tagName;
    if (tag === "B" || tag === "STRONG") next.bold = true;
    if (tag === "I" || tag === "EM") next.italics = true;
    if (tag === "U") next.underline = true;
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
    const bg = (child as HTMLElement).style?.backgroundColor;
    if (bg) next.highlight = bg;
    if (tag === "BR") {
      runs.push({ ...formatting, text: "\n" });
      continue;
    }
    runs.push(...elementInlineRuns(child, next));
  }
  return runs;
}

// ---------------------------------------------------------------------
// IR -> actual docx.js document
// ---------------------------------------------------------------------

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function runToTextRun(run: DocxRun): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italics,
    underline: run.underline ? {} : undefined,
    strike: run.strike,
    shading: run.highlight ? { fill: normalizeHex(run.highlight) } : undefined,
  });
}

function normalizeHex(color: string): string {
  // docx wants a bare hex string ("FFEE00"); accept css rgb()/#hex input.
  if (color.startsWith("#")) return color.slice(1);
  const rgb = color.match(/\d+/g);
  if (rgb && rgb.length >= 3) {
    return rgb
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("");
  }
  return "FFFF00";
}

/** Pure: turn IR blocks into `docx` Paragraph objects. */
export function blocksToDocxElements(blocks: DocxBlock[]): Paragraph[] {
  return blocks.map((block) => {
    const runs = (block.runs.length > 0 ? block.runs : [{ text: "" }]).map(runToTextRun);
    if (block.kind === "heading") {
      return new Paragraph({ heading: HEADING_LEVELS[block.level - 1], children: runs });
    }
    if (block.kind === "listItem") {
      return new Paragraph({
        bullet: block.ordered ? undefined : { level: 0 },
        numbering: block.ordered ? { reference: "noted-numbered-list", level: 0 } : undefined,
        children: runs,
      });
    }
    return new Paragraph({ children: runs });
  });
}

/** Build a full docx Document from IR blocks. */
export function buildDocxDocument(blocks: DocxBlock[]): Document {
  return new Document({
    numbering: {
      config: [
        {
          reference: "noted-numbered-list",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "start" }],
        },
      ],
    },
    sections: [{ children: blocksToDocxElements(blocks) }],
  });
}

/** DOM: build a .docx Blob for the given IR blocks. */
export function docxBlockstoBlob(blocks: DocxBlock[]): Promise<Blob> {
  return Packer.toBlob(buildDocxDocument(blocks));
}
