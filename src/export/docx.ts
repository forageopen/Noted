/**
 * src/export/docx.ts
 *
 * .docx export via the `docx` package.
 *
 * The Markdown-structure parsing (both the deterministic marked.lexer
 * path and the best-effort live-DOM path) lives in ../document-model.ts,
 * shared with the .json exporter - see that module's header comment for
 * why. This file's only job is turning that shared IR into real `docx`
 * package objects (Table/TableRow/TableCell, numbered/bulleted
 * Paragraphs, etc.) - the "IR -> docx.js" mapping is defined exactly
 * once, in `blocksToDocxElements` below.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { IParagraphOptions } from "docx";
import type { Block, InlineRun, ListItem, TableCell as IrTableCell } from "../document-model";
import { blocksFromElement, blocksFromTokens } from "../document-model";

// Re-exported for callers/tests that still want the docx-flavored names.
export { blocksFromTokens as tokensToBlocks, blocksFromElement as elementToBlocks };
export type { Block as DocxBlock, InlineRun as DocxRun };

function runToTextRun(run: InlineRun, size: number): TextRun {
  return new TextRun({
    text: run.text,
    font: run.code ? CODE_FONT_FAMILY : FONT_FAMILY,
    size,
    bold: run.bold,
    italics: run.italics,
    underline: run.underline ? {} : undefined,
    strike: run.strike,
    shading: run.highlight ? { fill: normalizeHex(run.highlight) } : undefined,
    // docx has no native "this run is a hyperlink" flag without wrapping
    // it in an ExternalHyperlink; we keep href fidelity simple (visually
    // distinguished, underlined) rather than pulling in relationship
    // machinery for a v1 structural exporter.
    style: run.href ? "Hyperlink" : undefined,
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

// Matches Word's own modern defaults (11pt Calibri, 1.15 line spacing) -
// deliberately NOT left unset, since docx's actual fallback when nothing
// specifies a font anywhere is the legacy Word default (Times New Roman),
// which is what was silently leaking through before this fix. Sizes are in
// half-points (docx's unit for font size) per the `docx` package's API.
const FONT_FAMILY = "Calibri";
const CODE_FONT_FAMILY = "Consolas";
const BODY_SIZE = 22; // 11pt
const HEADING_SIZES: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 32, // 16pt
  2: 28, // 14pt
  3: 26, // 13pt
  4: 24, // 12pt
  5: 22, // 11pt (bold differentiates it from body)
  6: 22,
};

// Paragraph/list spacing, in twips (1/20 pt) - docx's spacing unit. Applied
// explicitly on every paragraph rather than left to Word's own per-install
// "Normal" style default, which is inconsistent across Word versions/OSes
// and was the source of the reported spacing issues.
const BODY_SPACING = { line: 276, lineRule: "auto" as const, after: 200 };
const HEADING_SPACING = { before: 240, after: 120 };
const LIST_INDENT = { left: 720, hanging: 360 }; // 0.5in indent, 0.25in hanging - Word's own list defaults
const LIST_LEVEL_STEP = 360; // extra 0.25in indent per nesting level
const BLOCKQUOTE_INDENT = { left: 720 };
const CODE_SHADING = { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" };

function emptyRunFallback(runs: InlineRun[]): InlineRun[] {
  return runs.length > 0 ? runs : [{ text: "" }];
}

function inlineRunsToTextRuns(runs: InlineRun[], size: number): TextRun[] {
  return emptyRunFallback(runs).map((run) => runToTextRun(run, size));
}

function headingParagraph(level: 1 | 2 | 3 | 4 | 5 | 6, runs: InlineRun[]): Paragraph {
  return new Paragraph({
    heading: HEADING_LEVELS[level - 1],
    alignment: AlignmentType.LEFT,
    spacing: HEADING_SPACING,
    children: inlineRunsToTextRuns(runs, HEADING_SIZES[level]),
  });
}

function paragraphParagraph(runs: InlineRun[], extra: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: BODY_SPACING,
    children: inlineRunsToTextRuns(runs, BODY_SIZE),
    ...extra,
  });
}

function listItemParagraphs(item: ListItem, ordered: boolean, level: number): Paragraph[] {
  const indent = { left: LIST_INDENT.left + level * LIST_LEVEL_STEP, hanging: LIST_INDENT.hanging };
  const own = new Paragraph({
    numbering: { reference: ordered ? "noted-numbered-list" : "noted-bullet-list", level },
    alignment: AlignmentType.LEFT,
    spacing: BODY_SPACING,
    indent,
    children: inlineRunsToTextRuns(item.runs, BODY_SIZE),
  });
  const nested: Paragraph[] = [];
  for (const child of item.children) {
    if (child.kind === "list") {
      nested.push(...listBlockParagraphs(child, level + 1));
    } else {
      nested.push(...blockToParagraphs(child));
    }
  }
  return [own, ...nested];
}

function listBlockParagraphs(block: Extract<Block, { kind: "list" }>, level: number): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of block.items) {
    out.push(...listItemParagraphs(item, block.ordered, level));
  }
  return out;
}

function codeBlockParagraph(text: string): Paragraph {
  // A monospace-font paragraph with a shaded background, preserving the
  // raw code text verbatim (including internal newlines via explicit
  // line breaks - docx.js has no literal "\n in one TextRun" support).
  const lines = text.split("\n");
  const children: TextRun[] = [];
  lines.forEach((line, i) => {
    children.push(
      new TextRun({ text: line, font: CODE_FONT_FAMILY, size: BODY_SIZE, shading: CODE_SHADING, break: i > 0 ? 1 : undefined }),
    );
  });
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: BODY_SPACING, children });
}

function thematicBreakParagraph(): Paragraph {
  return new Paragraph({
    spacing: BODY_SPACING,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } },
    children: [],
  });
}

function alignmentType(align: "left" | "center" | "right" | null): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  if (align === "left") return AlignmentType.LEFT;
  return undefined;
}

function tableCellFromIr(cell: IrTableCell, align: "left" | "center" | "right" | null): TableCell {
  return new TableCell({
    width: { size: 100, type: WidthType.AUTO },
    children: [paragraphParagraph(cell.runs, { alignment: alignmentType(align) })],
  });
}

function tableFromIr(block: Extract<Block, { kind: "table" }>): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: block.header.map((cell, i) => tableCellFromIr(cell, block.align[i] ?? null)),
  });
  const bodyRows = block.rows.map(
    (row) => new TableRow({ children: row.map((cell, i) => tableCellFromIr(cell, block.align[i] ?? null)) }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function blockquoteParagraphs(block: Extract<Block, { kind: "blockquote" }>): Paragraph[] {
  const out: Paragraph[] = [];
  for (const inner of block.blocks) {
    if (inner.kind === "paragraph" || inner.kind === "heading") {
      const runs = inner.runs.map((r) => ({ ...r, italics: r.italics ?? true }));
      out.push(paragraphParagraph(runs, { indent: BLOCKQUOTE_INDENT }));
    } else {
      // Nested non-inline block (e.g. a blockquote containing a list) -
      // render normally but still indented one level, by delegating and
      // then it keeps its own semantics rather than being flattened.
      out.push(...blockToParagraphs(inner));
    }
  }
  return out;
}

/** Turn a single IR block into one or more docx Paragraphs (a Table block
 * is handled separately since it isn't a Paragraph - see
 * `blocksToDocxContent`). */
function blockToParagraphs(block: Block): Paragraph[] {
  switch (block.kind) {
    case "heading":
      return [headingParagraph(block.level, block.runs)];
    case "paragraph":
      return [paragraphParagraph(block.runs)];
    case "blockquote":
      return blockquoteParagraphs(block);
    case "codeBlock":
      return [codeBlockParagraph(block.text)];
    case "list":
      return listBlockParagraphs(block, 0);
    case "thematicBreak":
      return [thematicBreakParagraph()];
    case "table":
      // Tables aren't Paragraphs; callers must special-case them via
      // `blocksToDocxContent`. Returning [] here keeps this function's
      // type honest for the (rare) caller that only wants Paragraphs.
      return [];
  }
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

/** Pure: turn IR blocks into `docx` section content (Paragraphs and
 * Tables, in document order). This is the one place that maps IR
 * semantics onto docx.js constructs. */
export function blocksToDocxContent(blocks: Block[]): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.kind === "table") {
      content.push(tableFromIr(block));
    } else {
      content.push(...blockToParagraphs(block));
    }
  }
  return content;
}

/** Back-compat name: same as `blocksToDocxContent`, for callers/tests
 * that only care about the (much more common) Paragraph-producing
 * blocks. Kept because it's part of the existing test surface. */
export function blocksToDocxElements(blocks: Block[]): (Paragraph | Table)[] {
  return blocksToDocxContent(blocks);
}

/** Build a full docx Document from IR blocks. */
export function buildDocxDocument(blocks: Block[]): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_FAMILY, size: BODY_SIZE },
          paragraph: { spacing: BODY_SPACING },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "noted-numbered-list",
          levels: Array.from({ length: 6 }, (_, level) => ({
            level,
            format: "decimal" as const,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: LIST_INDENT.left + level * LIST_LEVEL_STEP, hanging: LIST_INDENT.hanging } } },
          })),
        },
        {
          reference: "noted-bullet-list",
          levels: Array.from({ length: 6 }, (_, level) => ({
            level,
            format: "bullet" as const,
            text: "•",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: LIST_INDENT.left + level * LIST_LEVEL_STEP, hanging: LIST_INDENT.hanging } } },
          })),
        },
      ],
    },
    sections: [{ children: blocksToDocxContent(blocks) }],
  });
}

/** DOM: build a .docx Blob for the given IR blocks. */
export function docxBlockstoBlob(blocks: Block[]): Promise<Blob> {
  return Packer.toBlob(buildDocxDocument(blocks));
}
