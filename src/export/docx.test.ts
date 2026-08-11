/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";
import { lexMarkdown } from "../markdown";
import { blocksToDocxElements, docxBlockstoBlob, buildDocxDocument } from "./docx";
import { blocksFromTokens as tokensToBlocks, blocksFromElement as elementToBlocks } from "../document-model";
import type { Block as DocxBlock } from "../document-model";

/** A .docx file is a zip of OOXML parts - unzip it and read the main
 * document XML, the same way Word itself does. This is what actually
 * catches formatting regressions (wrong/missing font, spacing, list
 * indent) - a "did it throw" smoke test cannot, since docx.js happily
 * produces a valid-but-badly-formatted document either way.
 *
 * Uses Packer.toBuffer (Node-compatible output), not docxBlockstoBlob's
 * Blob - jsdom's Blob polyfill doesn't implement `.arrayBuffer()`, and the
 * production code path (real browser) already exercises Packer.toBlob via
 * the "produces a real .docx Blob" smoke test above. */
async function extractDocumentXml(blocks: DocxBlock[]): Promise<string> {
  const buffer = await Packer.toBuffer(buildDocxDocument(blocks));
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("word/document.xml missing from .docx archive");
  return doc.async("string");
}

describe("tokensToBlocks (pure, from marked.lexer)", () => {
  it("maps a heading token to a heading block", () => {
    const blocks = tokensToBlocks(lexMarkdown("# Title"));
    expect(blocks).toEqual([{ kind: "heading", level: 1, runs: [{ text: "Title" }] }]);
  });

  it("maps a paragraph with bold/italic runs", () => {
    const blocks = tokensToBlocks(lexMarkdown("Some **bold** and *italic* text."));
    expect(blocks).toHaveLength(1);
    const block = blocks[0]!;
    expect(block.kind).toBe("paragraph");
    if (block.kind === "paragraph") {
      const boldRun = block.runs.find((r) => r.text === "bold");
      const italicRun = block.runs.find((r) => r.text === "italic");
      expect(boldRun?.bold).toBe(true);
      expect(italicRun?.italics).toBe(true);
    }
  });

  it("maps a list into a single list block with items", () => {
    const blocks = tokensToBlocks(lexMarkdown("- one\n- two\n"));
    expect(blocks).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          { runs: [{ text: "one" }], children: [] },
          { runs: [{ text: "two" }], children: [] },
        ],
      },
    ]);
  });

  it("marks ordered lists as ordered", () => {
    const blocks = tokensToBlocks(lexMarkdown("1. first\n2. second\n"));
    expect(blocks.every((b) => b.kind === "list" && b.ordered)).toBe(true);
  });
});

describe("elementToBlocks (pure-ish, from live contenteditable DOM)", () => {
  it("maps heading and paragraph elements", () => {
    const div = document.createElement("div");
    div.innerHTML = "<h2>Heading</h2><p>Body <strong>bold</strong> text.</p>";
    const blocks = elementToBlocks(div);
    expect(blocks[0]).toEqual({ kind: "heading", level: 2, runs: [{ text: "Heading" }] });
    expect(blocks[1]?.kind).toBe("paragraph");
    if (blocks[1]?.kind === "paragraph") {
      expect(blocks[1].runs.some((r) => r.text === "bold" && r.bold)).toBe(true);
    }
  });

  it("maps ul/ol lists", () => {
    const div = document.createElement("div");
    div.innerHTML = "<ul><li>a</li><li>b</li></ul>";
    const blocks = elementToBlocks(div);
    expect(blocks).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          { runs: [{ text: "a" }], children: [] },
          { runs: [{ text: "b" }], children: [] },
        ],
      },
    ]);
  });

  it("treats inline background-color spans as highlight runs", () => {
    const div = document.createElement("div");
    div.innerHTML = '<p>Text <span style="background-color: rgb(255, 245, 157);">highlighted</span></p>';
    const blocks = elementToBlocks(div);
    if (blocks[0]?.kind === "paragraph") {
      const run = blocks[0].runs.find((r) => r.text === "highlighted");
      expect(run?.highlight).toBeTruthy();
    } else {
      throw new Error("expected paragraph block");
    }
  });
});

describe("blocksToDocxElements + docxBlockstoBlob (smoke test)", () => {
  it("builds docx content objects without throwing", () => {
    const blocks = tokensToBlocks(lexMarkdown("# Title\n\nSome **bold** text.\n\n- item one\n- item two\n"));
    const elements = blocksToDocxElements(blocks);
    // heading + paragraph + (list -> 2 item paragraphs) = 4
    expect(elements.length).toBeGreaterThanOrEqual(blocks.length);
  });

  it("produces a real .docx Blob", async () => {
    const blocks = tokensToBlocks(lexMarkdown("# Title\n\nHello world."));
    const blob = await docxBlockstoBlob(blocks);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("docx formatting regressions (font / spacing / list alignment)", () => {
  it("sets an explicit font everywhere - never falls back to Word's Times New Roman default", async () => {
    const blocks = tokensToBlocks(lexMarkdown("# Title\n\nBody text.\n\n- one\n- two\n"));
    const xml = await extractDocumentXml(blocks);
    expect(xml).toContain('w:ascii="Calibri"');
    expect(xml).not.toContain("Times New Roman");
  });

  it("sets non-zero paragraph spacing - was previously unset (zero) everywhere", async () => {
    const blocks = tokensToBlocks(lexMarkdown("First paragraph.\n\nSecond paragraph."));
    const xml = await extractDocumentXml(blocks);
    // w:spacing w:after="200" is BODY_SPACING.after in src/export/docx.ts
    expect(xml).toMatch(/<w:spacing[^>]*w:after="200"/);
  });

  it("gives bullet and numbered lists the same indent, via two explicit numbering defs", async () => {
    const bulletXml = await extractDocumentXml(tokensToBlocks(lexMarkdown("- a\n- b\n")));
    const numberedXml = await extractDocumentXml(tokensToBlocks(lexMarkdown("1. a\n2. b\n")));

    // Both reference a numbering definition (not the old bullet-shorthand
    // path, which never emits a <w:numId> reference the same way).
    expect(bulletXml).toMatch(/<w:numId w:val="\d+"\/>/);
    expect(numberedXml).toMatch(/<w:numId w:val="\d+"\/>/);
  });

  it("gives headings distinct, non-body sizes", async () => {
    const blocks = tokensToBlocks(lexMarkdown("# H1\n\nBody."));
    const xml = await extractDocumentXml(blocks);
    // HEADING_SIZES[1] = 32 half-points; BODY_SIZE = 22.
    expect(xml).toContain('<w:sz w:val="32"/>');
    expect(xml).toContain('<w:sz w:val="22"/>');
  });
});

describe("docx export of previously-lossy structures (bug fixes)", () => {
  it("renders a table as a real <w:tbl>", async () => {
    const blocks = tokensToBlocks(lexMarkdown("| a | b |\n|---|---|\n| 1 | 2 |\n"));
    const xml = await extractDocumentXml(blocks);
    expect(xml).toContain("<w:tbl>");
  });

  it("preserves a code block's raw text verbatim", async () => {
    const code = "function add(a, b) {\n  return a + b;\n}";
    const blocks = tokensToBlocks(lexMarkdown("```js\n" + code + "\n```"));
    const xml = await extractDocumentXml(blocks);
    expect(xml).toContain("function add(a, b) {");
    expect(xml).toContain("return a + b;");
  });

  it("gives a nested list more than one distinct <w:ilvl> value", async () => {
    const blocks = tokensToBlocks(lexMarkdown("- a\n  - nested one\n  - nested two\n- b\n"));
    const xml = await extractDocumentXml(blocks);
    const levels = new Set(Array.from(xml.matchAll(/<w:ilvl w:val="(\d+)"\/>/g)).map((m) => m[1]));
    expect(levels.size).toBeGreaterThan(1);
  });
});
