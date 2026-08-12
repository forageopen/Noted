/**
 * src/document-model.ts
 *
 * The single shared document Intermediate Representation (IR) for Noted's
 * structural exporters (.docx, .json). Both exporters need "what is this
 * document actually made of" (headings/paragraphs/lists/tables/code
 * blocks/etc.), not "what does it look like rendered" (that's what .html
 * and .pdf export use the live DOM/print pipeline for instead - see
 * src/export/html.ts and Pane.printPane in src/pane.ts).
 *
 * Two ways a Pane's content can reach an IR-consuming exporter:
 *  1. Fresh from a loaded file, never touched in the Edit tab: we still
 *     have the original Markdown text, so we build the IR from
 *     `marked.lexer()`'s token tree (`blocksFromTokens`) - per
 *     PRODUCT-SPEC.md Section 3, this avoids trying to reverse-engineer
 *     structure out of rendered HTML. marked has already done the actual
 *     Markdown parsing (tables, code fences with language, nested lists,
 *     link hrefs, etc.) - this module walks its token tree faithfully
 *     rather than re-deriving structure with its own heuristics.
 *  2. Edited in the Edit tab: the Edit tab is a contenteditable region
 *     (see src/pane.ts for why HTML, not Markdown, is that tab's source
 *     of truth), so there is no Markdown text for the edited result -
 *     `execCommand` mutates HTML directly. For this path we walk the
 *     live contenteditable DOM instead (`blocksFromElement`).
 *
 * Both paths converge on the same IR (`Block[]` / `InlineRun[]`). Exactly
 * one place (src/export/docx.ts's `blocksToDocxElements`) maps this IR
 * onto docx.js constructs, and one place (src/export/json.ts) serializes
 * it to JSON - so "heading / paragraph / bold / italic / list / table /
 * code / quote" semantics are defined exactly once, regardless of which
 * of the two paths produced the IR, and regardless of which exporter
 * consumes it.
 */

import type { Token, Tokens } from "./markdown";

// ---------------------------------------------------------------------
// IR types
// ---------------------------------------------------------------------

export type Alignment = "left" | "center" | "right" | null;

export interface InlineRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Inline code (codespan / DOM <code>) - distinct from plain text so
   * consumers can render it in a monospace font instead of losing the
   * distinction, as the old flat IR did. */
  code?: boolean;
  /** CSS color string (hex or rgb()) backing the highlighter tool /
   * `==mark==`-equivalent highlight. */
  highlight?: string;
  /** Link destination, when this run came from an <a>/markdown link. */
  href?: string;
}

export interface TableCell {
  runs: InlineRun[];
}

export interface ListItem {
  /** The item's own inline content (its first/only paragraph of text). */
  runs: InlineRun[];
  /** Nested block content inside this item - in practice this is almost
   * always zero or more nested `list` blocks, but is kept general (a
   * loose list item's extra paragraphs, etc.) since marked's token tree
   * can produce arbitrary nested blocks under a list item. */
  children: Block[];
}

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: InlineRun[] }
  | { kind: "paragraph"; runs: InlineRun[] }
  | { kind: "blockquote"; blocks: Block[] }
  | { kind: "codeBlock"; lang?: string; text: string }
  | { kind: "list"; ordered: boolean; items: ListItem[] }
  | { kind: "table"; header: TableCell[]; rows: TableCell[][]; align: Alignment[] }
  | { kind: "thematicBreak" };

export interface NotedDocument {
  blocks: Block[];
}

// ---------------------------------------------------------------------
// Path 1: Markdown token tree (marked.lexer output) -> Block[]
// ---------------------------------------------------------------------

/** Pure: convert marked's token tree into the shared IR. */
export function blocksFromTokens(tokens: Token[]): Block[] {
  const blocks: Block[] = [];
  for (const token of tokens) {
    appendTokenBlocks(token, blocks);
  }
  return blocks;
}

function appendTokenBlocks(token: Token, blocks: Block[]): void {
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
      blocks.push(listTokenToBlock(token as Tokens.List));
      break;
    }
    case "blockquote": {
      const blockquote = token as Tokens.Blockquote;
      blocks.push({ kind: "blockquote", blocks: blocksFromTokens(blockquote.tokens ?? []) });
      break;
    }
    case "code": {
      const code = token as Tokens.Code;
      blocks.push({ kind: "codeBlock", lang: code.lang || undefined, text: code.text });
      break;
    }
    case "table": {
      const table = token as Tokens.Table;
      blocks.push({
        kind: "table",
        header: table.header.map((cell) => ({ runs: inlineTokensToRuns(cell.tokens ?? []) })),
        rows: table.rows.map((row) => row.map((cell) => ({ runs: inlineTokensToRuns(cell.tokens ?? []) }))),
        align: table.align.map((a) => a ?? null),
      });
      break;
    }
    case "hr": {
      blocks.push({ kind: "thematicBreak" });
      break;
    }
    case "space":
      break;
    default: {
      // Anything genuinely unhandled (raw html blocks, etc.) still falls
      // back to a plain paragraph of its text so nothing silently
      // disappears - but code/tables/hr/nested lists (the previously
      // lossy cases) are now handled explicitly above.
      const text = "text" in token && typeof token.text === "string" ? token.text : token.raw;
      if (text && text.trim().length > 0) {
        blocks.push({ kind: "paragraph", runs: [{ text }] });
      }
    }
  }
}

function listTokenToBlock(list: Tokens.List): Block {
  return {
    kind: "list",
    ordered: list.ordered === true,
    items: list.items.map(listItemToIr),
  };
}

function listItemToIr(item: Tokens.ListItem): ListItem {
  const inline: Token[] = [];
  const children: Block[] = [];
  for (const child of item.tokens ?? []) {
    if (child.type === "list") {
      // Nested list - previously silently dropped by flattenListItemInline.
      children.push(listTokenToBlock(child as Tokens.List));
    } else if (child.type === "text") {
      const textToken = child as Tokens.Text;
      if (textToken.tokens && textToken.tokens.length > 0) {
        inline.push(...textToken.tokens);
      } else {
        inline.push(textToken);
      }
    } else if (child.type === "space") {
      // Blank line between a loose item's own paragraphs - no IR content.
    } else {
      // Loose list items can contain full paragraph/blockquote/etc.
      // tokens as extra block children.
      appendTokenBlocks(child, children);
    }
  }
  return { runs: inlineTokensToRuns(inline), children };
}

function inlineTokensToRuns(tokens: Token[], formatting: Partial<InlineRun> = {}): InlineRun[] {
  const runs: InlineRun[] = [];
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
        runs.push({ ...formatting, code: true, text: (token as Tokens.Codespan).text });
        break;
      case "link": {
        const link = token as Tokens.Link;
        runs.push(...inlineTokensToRuns(link.tokens, { ...formatting, href: link.href }));
        break;
      }
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
// Path 2: live contenteditable DOM -> Block[]
// ---------------------------------------------------------------------

const HEADING_TAGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

/** Pure(ish - takes a detached-safe DOM element): walk edited HTML into IR.
 *
 * The Edit tab's own toolbar can only ever produce headings (inherited
 * from the loaded Markdown - it has no "make heading" tool), paragraphs,
 * bold/italic/underline/strike, highlight spans, and (via the loaded
 * Markdown's rendered lists) uls/ols/blockquotes/links. It has no tool to
 * create a table or a code block. Real DOM nodes for those CAN still show
 * up here if the user pastes rich HTML into the contenteditable region
 * (browsers preserve pasted <table>/<pre><code> structure), so this walk
 * still recognizes TABLE/PRE>CODE nodes defensively - it just never tries
 * to *infer* a table or code block from plain text heuristically (e.g.
 * from tab-separated text, or a monospace-looking paragraph), since that
 * would be exactly the kind of heuristic re-derivation the deterministic
 * token path is meant to avoid needing.
 */
export function blocksFromElement(root: Element): Block[] {
  const blocks: Block[] = [];
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

function appendElementBlocks(el: Element, blocks: Block[]): void {
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
    const inner: Block[] = [];
    for (const child of Array.from(el.children)) {
      appendElementBlocks(child, inner);
    }
    if (inner.length === 0) {
      const runs = elementInlineRuns(el, {});
      if (runs.some((r) => r.text.trim().length > 0)) inner.push({ kind: "paragraph", runs });
    }
    blocks.push({ kind: "blockquote", blocks: inner });
    return;
  }
  if (tag === "UL" || tag === "OL") {
    blocks.push(listElementToBlock(el));
    return;
  }
  if (tag === "HR") {
    blocks.push({ kind: "thematicBreak" });
    return;
  }
  if (tag === "PRE") {
    const codeEl = el.querySelector("code");
    const langMatch = codeEl?.className.match(/language-(\S+)/);
    blocks.push({
      kind: "codeBlock",
      lang: langMatch?.[1],
      text: (codeEl ?? el).textContent ?? "",
    });
    return;
  }
  if (tag === "TABLE") {
    blocks.push(tableElementToBlock(el));
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

function listElementToBlock(el: Element): Block {
  const ordered = el.tagName === "OL";
  const items: ListItem[] = [];
  for (const li of Array.from(el.children)) {
    if (li.tagName !== "LI") continue;
    const nestedLists = Array.from(li.children).filter((c) => c.tagName === "UL" || c.tagName === "OL");
    // Inline runs for the item come only from the direct (non-nested-list)
    // content; nested lists become their own block children instead of
    // being flattened/dropped.
    const clone = li.cloneNode(true) as Element;
    for (const nested of Array.from(clone.children)) {
      if (nested.tagName === "UL" || nested.tagName === "OL") clone.removeChild(nested);
    }
    const runs = elementInlineRuns(clone, {});
    const children = nestedLists.map((nested) => listElementToBlock(nested));
    items.push({ runs, children });
  }
  return { kind: "list", ordered, items };
}

function tableElementToBlock(el: Element): Block {
  const rowsEls = Array.from(el.querySelectorAll("tr"));
  const header: TableCell[] = [];
  const rows: TableCell[][] = [];
  const align: Alignment[] = [];
  let headerCaptured = false;
  for (const tr of rowsEls) {
    const cellEls = Array.from(tr.children).filter((c) => c.tagName === "TH" || c.tagName === "TD");
    if (!headerCaptured && cellEls.length > 0 && cellEls.every((c) => c.tagName === "TH")) {
      for (const cell of cellEls) {
        header.push({ runs: elementInlineRuns(cell, {}) });
        align.push(cellAlignment(cell));
      }
      headerCaptured = true;
      continue;
    }
    rows.push(cellEls.map((cell) => ({ runs: elementInlineRuns(cell, {}) })));
  }
  return { kind: "table", header, rows, align };
}

// ---------------------------------------------------------------------
// Path 3: IR -> Markdown text (used for .docx-upload compatibility: a
// loaded .docx is converted docx -> HTML (mammoth) -> IR (blocksFromElement,
// above) -> Markdown text here, so the rest of the app - viewer render,
// Edit tab, .md/.html/.pdf export - never has to know a file didn't
// originally come from a .md file. Best-effort, not lossless: markdown has
// no native underline or arbitrary-color-highlight syntax, so those fall
// back to inline HTML (<u>, <mark>), same tradeoff already accepted for
// data round-tripped through this IR (see InlineRun's doc comment).
// ---------------------------------------------------------------------

/** Pure: serialize IR blocks back into Markdown source text. */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => blockToMarkdown(block)).join("\n\n");
}

function blockToMarkdown(block: Block, indent = ""): string {
  switch (block.kind) {
    case "heading":
      return indent + "#".repeat(block.level) + " " + runsToMarkdown(block.runs);
    case "paragraph":
      return indent + runsToMarkdown(block.runs);
    case "thematicBreak":
      return indent + "---";
    case "codeBlock": {
      const fence = "```" + (block.lang ?? "");
      const lines = block.text.split("\n").map((line) => indent + line);
      return `${indent}${fence}\n${lines.join("\n")}\n${indent}\`\`\``;
    }
    case "blockquote":
      return block.blocks
        .map((child) => blockToMarkdown(child))
        .join("\n\n")
        .split("\n")
        .map((line) => (line.length > 0 ? `${indent}> ${line}` : `${indent}>`))
        .join("\n");
    case "list":
      return block.items
        .map((item, i) => {
          const marker = block.ordered ? `${i + 1}. ` : "- ";
          const firstLine = `${indent}${marker}${runsToMarkdown(item.runs)}`;
          const childIndent = indent + " ".repeat(marker.length);
          const children = item.children.map((child) => blockToMarkdown(child, childIndent)).join("\n\n");
          return children.length > 0 ? `${firstLine}\n\n${children}` : firstLine;
        })
        .join("\n");
    case "table":
      return tableToMarkdown(block, indent);
  }
}

function tableToMarkdown(table: Extract<Block, { kind: "table" }>, indent: string): string {
  const headerCells = table.header.map((cell) => runsToMarkdown(cell.runs) || " ");
  const separator = table.align.map((align) => {
    if (align === "center") return ":---:";
    if (align === "right") return "---:";
    if (align === "left") return ":---";
    return "---";
  });
  const rows = table.rows.map((row) => row.map((cell) => runsToMarkdown(cell.runs) || " "));
  const toRow = (cells: string[]) => `${indent}| ${cells.join(" | ")} |`;
  return [toRow(headerCells), toRow(separator), ...rows.map(toRow)].join("\n");
}

function runsToMarkdown(runs: InlineRun[]): string {
  return runs.map(runToMarkdown).join("").replace(/\n/g, "  \n");
}

function runToMarkdown(run: InlineRun): string {
  if (run.code) return `\`${run.text}\``;
  let text = escapeMarkdown(run.text);
  if (run.bold && run.italics) text = `***${text}***`;
  else if (run.bold) text = `**${text}**`;
  else if (run.italics) text = `*${text}*`;
  if (run.strike) text = `~~${text}~~`;
  if (run.underline) text = `<u>${text}</u>`;
  if (run.href) text = `[${text}](${run.href})`;
  if (run.highlight) text = `<mark style="background:${run.highlight}">${text}</mark>`;
  return text;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function cellAlignment(cell: Element): Alignment {
  const style = (cell as HTMLElement).style?.textAlign;
  if (style === "left" || style === "center" || style === "right") return style;
  const attr = cell.getAttribute("align");
  if (attr === "left" || attr === "center" || attr === "right") return attr;
  return null;
}

function elementInlineRuns(el: Element, formatting: Partial<InlineRun>): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const text = node.textContent ?? "";
      if (text.length > 0) runs.push({ ...formatting, text });
      continue;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;
    const child = node as Element;
    const next: Partial<InlineRun> = { ...formatting };
    const tag = child.tagName;
    if (tag === "B" || tag === "STRONG") next.bold = true;
    if (tag === "I" || tag === "EM") next.italics = true;
    if (tag === "U") next.underline = true;
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
    if (tag === "CODE") next.code = true;
    if (tag === "A") {
      const href = child.getAttribute("href");
      if (href) next.href = href;
    }
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
