import { describe, expect, it } from "vitest";
import { lexMarkdown } from "../markdown";
import { blocksFromTokens } from "../document-model";
import { blocksToJson } from "./json";
import type { NotedJsonDocument } from "./json";

const SAMPLE_MARKDOWN = `# Title

A paragraph with **bold**, *italic*, and \`inline code\`, plus a [link](https://example.com).

> A blockquote.

\`\`\`js
console.log("hi");
\`\`\`

- one
  - nested
- two

| a | b |
|:--|--:|
| 1 | 2 |

---

Final paragraph.
`;

describe("blocksToJson (round-trips through JSON.parse)", () => {
  it("produces valid, pretty-printed JSON that parses back to an equivalent structure", () => {
    const blocks = blocksFromTokens(lexMarkdown(SAMPLE_MARKDOWN));
    const json = blocksToJson(blocks);

    // Pretty-printed: has newlines/indentation, not a single line.
    expect(json).toContain("\n");
    expect(json.split("\n").length).toBeGreaterThan(5);

    const parsed = JSON.parse(json) as NotedJsonDocument;
    expect(parsed.version).toBe(1);
    expect(parsed.blocks).toEqual(blocks);
  });

  it("round-trips every block kind present in the sample document", () => {
    const blocks = blocksFromTokens(lexMarkdown(SAMPLE_MARKDOWN));
    const parsed = JSON.parse(blocksToJson(blocks)) as NotedJsonDocument;
    const kinds = new Set(parsed.blocks.map((b) => b.kind));
    expect(kinds).toEqual(
      new Set(["heading", "paragraph", "blockquote", "codeBlock", "list", "table", "thematicBreak"]),
    );
  });

  it("preserves link href and inline code distinction through the round trip", () => {
    const blocks = blocksFromTokens(lexMarkdown(SAMPLE_MARKDOWN));
    const parsed = JSON.parse(blocksToJson(blocks)) as NotedJsonDocument;
    const paragraph = parsed.blocks.find((b) => b.kind === "paragraph" && b.runs.some((r) => r.href));
    if (!paragraph || paragraph.kind !== "paragraph") throw new Error("expected a paragraph with a link run");
    const linkRun = paragraph.runs.find((r) => r.href);
    expect(linkRun?.href).toBe("https://example.com");
    const codeRun = paragraph.runs.find((r) => r.code);
    expect(codeRun?.text).toBe("inline code");
  });

  it("preserves nested list structure through the round trip", () => {
    const blocks = blocksFromTokens(lexMarkdown(SAMPLE_MARKDOWN));
    const parsed = JSON.parse(blocksToJson(blocks)) as NotedJsonDocument;
    const list = parsed.blocks.find((b) => b.kind === "list");
    if (!list || list.kind !== "list") throw new Error("expected a list block");
    expect(list.items[0]!.children).toHaveLength(1);
    expect(list.items[0]!.children[0]!.kind).toBe("list");
  });

  it("preserves table header/rows/alignment through the round trip", () => {
    const blocks = blocksFromTokens(lexMarkdown(SAMPLE_MARKDOWN));
    const parsed = JSON.parse(blocksToJson(blocks)) as NotedJsonDocument;
    const table = parsed.blocks.find((b) => b.kind === "table");
    if (!table || table.kind !== "table") throw new Error("expected a table block");
    expect(table.align).toEqual(["left", "right"]);
    expect(table.rows).toEqual([[{ runs: [{ text: "1" }] }, { runs: [{ text: "2" }] }]]);
  });
});
