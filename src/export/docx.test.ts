/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { lexMarkdown } from "../markdown";
import { tokensToBlocks, elementToBlocks, blocksToDocxElements, docxBlockstoBlob } from "./docx";

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

  it("maps a list into listItem blocks", () => {
    const blocks = tokensToBlocks(lexMarkdown("- one\n- two\n"));
    expect(blocks).toEqual([
      { kind: "listItem", ordered: false, runs: [{ text: "one" }] },
      { kind: "listItem", ordered: false, runs: [{ text: "two" }] },
    ]);
  });

  it("marks ordered lists as ordered", () => {
    const blocks = tokensToBlocks(lexMarkdown("1. first\n2. second\n"));
    expect(blocks.every((b) => b.kind === "listItem" && b.ordered)).toBe(true);
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
      { kind: "listItem", ordered: false, runs: [{ text: "a" }] },
      { kind: "listItem", ordered: false, runs: [{ text: "b" }] },
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
  it("builds docx Paragraph objects without throwing", () => {
    const blocks = tokensToBlocks(lexMarkdown("# Title\n\nSome **bold** text.\n\n- item one\n- item two\n"));
    const elements = blocksToDocxElements(blocks);
    expect(elements).toHaveLength(blocks.length);
  });

  it("produces a real .docx Blob", async () => {
    const blocks = tokensToBlocks(lexMarkdown("# Title\n\nHello world."));
    const blob = await docxBlockstoBlob(blocks);
    expect(blob.size).toBeGreaterThan(0);
  });
});
