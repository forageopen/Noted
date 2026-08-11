/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { lexMarkdown } from "./markdown";
import { blocksFromElement, blocksFromTokens } from "./document-model";
import type { Block } from "./document-model";

describe("blocksFromTokens (from marked.lexer)", () => {
  it("preserves nested list structure instead of flattening/dropping it", () => {
    const blocks = blocksFromTokens(lexMarkdown("- a\n  - nested one\n  - nested two\n- b\n"));
    expect(blocks).toHaveLength(1);
    const list = blocks[0]!;
    if (list.kind !== "list") throw new Error("expected list block");
    expect(list.items).toHaveLength(2);
    const [itemA, itemB] = list.items;
    expect(itemA!.runs).toEqual([{ text: "a" }]);
    expect(itemA!.children).toHaveLength(1);
    const nested = itemA!.children[0]!;
    if (nested.kind !== "list") throw new Error("expected nested list block");
    expect(nested.items.map((i) => i.runs)).toEqual([[{ text: "nested one" }], [{ text: "nested two" }]]);
    expect(itemB!.runs).toEqual([{ text: "b" }]);
  });

  it("preserves table header, rows, and per-column alignment", () => {
    const blocks = blocksFromTokens(lexMarkdown("| a | b |\n|:--|:-:|\n| 1 | 2 |\n"));
    const table = blocks[0]!;
    if (table.kind !== "table") throw new Error("expected table block");
    expect(table.header.map((c) => c.runs)).toEqual([[{ text: "a" }], [{ text: "b" }]]);
    expect(table.rows).toEqual([[{ runs: [{ text: "1" }] }, { runs: [{ text: "2" }] }]]);
    expect(table.align).toEqual(["left", "center"]);
  });

  it("preserves code block raw text and language", () => {
    const code = "const x = 1;\nconsole.log(x);";
    const blocks = blocksFromTokens(lexMarkdown("```ts\n" + code + "\n```"));
    const block = blocks[0]!;
    if (block.kind !== "codeBlock") throw new Error("expected codeBlock");
    expect(block.text).toBe(code);
    expect(block.lang).toBe("ts");
  });

  it("keeps blockquotes as a nested block, not flattened into the surrounding blocks", () => {
    const blocks = blocksFromTokens(lexMarkdown("> quoted line\n\nAfter quote."));
    expect(blocks).toHaveLength(2);
    const quote = blocks[0]!;
    if (quote.kind !== "blockquote") throw new Error("expected blockquote");
    expect(quote.blocks).toHaveLength(1);
    expect(quote.blocks[0]!.kind).toBe("paragraph");
    expect(blocks[1]!.kind).toBe("paragraph");
  });

  it("emits a thematic-break block for a horizontal rule", () => {
    const blocks = blocksFromTokens(lexMarkdown("above\n\n---\n\nbelow"));
    expect(blocks.some((b) => b.kind === "thematicBreak")).toBe(true);
  });

  it("preserves link href on the inline run", () => {
    const blocks = blocksFromTokens(lexMarkdown("See [docs](https://example.com/docs) for more."));
    const para = blocks[0]!;
    if (para.kind !== "paragraph") throw new Error("expected paragraph");
    const linkRun = para.runs.find((r) => r.text === "docs");
    expect(linkRun?.href).toBe("https://example.com/docs");
  });

  it("marks inline code (codespan) as a distinct run kind from plain text", () => {
    const blocks = blocksFromTokens(lexMarkdown("Use `const x = 1` here."));
    const para = blocks[0]!;
    if (para.kind !== "paragraph") throw new Error("expected paragraph");
    const codeRun = para.runs.find((r) => r.text === "const x = 1");
    const plainRun = para.runs.find((r) => r.text.includes("Use"));
    expect(codeRun?.code).toBe(true);
    expect(plainRun?.code).toBeFalsy();
  });
});

describe("blocksFromElement (from live contenteditable DOM)", () => {
  it("preserves nested ul/ol structure in the DOM", () => {
    const div = document.createElement("div");
    div.innerHTML = "<ul><li>a<ul><li>nested one</li><li>nested two</li></ul></li><li>b</li></ul>";
    const blocks = blocksFromElement(div);
    const list = blocks[0]!;
    if (list.kind !== "list") throw new Error("expected list block");
    const itemA = list.items[0]!;
    expect(itemA.runs.map((r) => r.text).join("")).toBe("a");
    expect(itemA.children).toHaveLength(1);
    const nested = itemA.children[0] as Extract<Block, { kind: "list" }>;
    expect(nested.kind).toBe("list");
    expect(nested.items.map((i) => i.runs.map((r) => r.text).join(""))).toEqual(["nested one", "nested two"]);
  });

  it("nests blockquote content rather than flattening it", () => {
    const div = document.createElement("div");
    div.innerHTML = "<blockquote><p>quoted</p></blockquote><p>after</p>";
    const blocks = blocksFromElement(div);
    expect(blocks[0]!.kind).toBe("blockquote");
    if (blocks[0]!.kind === "blockquote") {
      expect(blocks[0]!.blocks[0]!.kind).toBe("paragraph");
    }
    expect(blocks[1]!.kind).toBe("paragraph");
  });

  it("preserves link href from an anchor element", () => {
    const div = document.createElement("div");
    div.innerHTML = '<p>See <a href="https://example.com">this</a>.</p>';
    const blocks = blocksFromElement(div);
    const para = blocks[0]!;
    if (para.kind !== "paragraph") throw new Error("expected paragraph");
    const linkRun = para.runs.find((r) => r.text === "this");
    expect(linkRun?.href).toBe("https://example.com");
  });

  it("marks a <code> element as a distinct run kind from plain text", () => {
    const div = document.createElement("div");
    div.innerHTML = "<p>Use <code>const x = 1</code> here.</p>";
    const blocks = blocksFromElement(div);
    const para = blocks[0]!;
    if (para.kind !== "paragraph") throw new Error("expected paragraph");
    const codeRun = para.runs.find((r) => r.text === "const x = 1");
    expect(codeRun?.code).toBe(true);
  });

  it("defensively recognizes a pasted <table> element", () => {
    const div = document.createElement("div");
    div.innerHTML = "<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>";
    const blocks = blocksFromElement(div);
    const table = blocks[0]!;
    if (table.kind !== "table") throw new Error("expected table block");
    expect(table.header.map((c) => c.runs.map((r) => r.text).join(""))).toEqual(["a", "b"]);
    expect(table.rows).toHaveLength(1);
  });

  it("defensively recognizes a pasted <pre><code> code block", () => {
    const div = document.createElement("div");
    div.innerHTML = '<pre><code class="language-js">const x = 1;</code></pre>';
    const blocks = blocksFromElement(div);
    const block = blocks[0]!;
    if (block.kind !== "codeBlock") throw new Error("expected codeBlock");
    expect(block.text).toBe("const x = 1;");
    expect(block.lang).toBe("js");
  });
});
