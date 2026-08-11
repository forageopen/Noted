import { describe, expect, it } from "vitest";
import { renderMarkdown, lexMarkdown, stripFrontmatter } from "./markdown";

describe("renderMarkdown", () => {
  it("renders a heading", () => {
    expect(renderMarkdown("# Hello")).toContain("<h1>Hello</h1>");
  });

  it("renders bold and italic", () => {
    const html = renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders a table (gfm)", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |\n");
    expect(html).toContain("<table>");
  });

  it("renders a code block", () => {
    const html = renderMarkdown("```\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code>");
  });
});

describe("lexMarkdown", () => {
  it("produces a heading token", () => {
    const tokens = lexMarkdown("# Title\n\nBody text.");
    expect(tokens[0]?.type).toBe("heading");
    expect(tokens[1]?.type).toBe("paragraph");
  });

  it("produces a list token with items", () => {
    const tokens = lexMarkdown("- one\n- two\n");
    const list = tokens.find((t) => t.type === "list");
    expect(list).toBeDefined();
    if (list && list.type === "list") {
      expect(list.items.length).toBe(2);
    }
  });
});

describe("stripFrontmatter", () => {
  it("strips a leading YAML frontmatter block", () => {
    const source = "---\ndoc_id: FOO\ntags: [a, b]\n---\n\n# Title\n\nBody.";
    expect(stripFrontmatter(source)).toBe("# Title\n\nBody.");
  });

  it("leaves content unchanged when there is no frontmatter", () => {
    const source = "# Title\n\nBody.";
    expect(stripFrontmatter(source)).toBe(source);
  });

  it("leaves content unchanged when the opening --- has no matching close", () => {
    const source = "---\ndoc_id: FOO\n\n# Title with a literal --- in it too";
    expect(stripFrontmatter(source)).toBe(source);
  });

  it("does not treat a mid-document horizontal rule as frontmatter", () => {
    const source = "# Title\n\n---\n\nMore text.";
    expect(stripFrontmatter(source)).toBe(source);
  });

  it("handles an empty frontmatter block", () => {
    const source = "---\n---\n\n# Title";
    expect(stripFrontmatter(source)).toBe("# Title");
  });
});
