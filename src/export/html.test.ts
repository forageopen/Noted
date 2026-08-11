import { describe, expect, it } from "vitest";
import { buildStandaloneHtml, withExtension } from "./html";

describe("buildStandaloneHtml (pure)", () => {
  it("embeds the title, theme, and body html", () => {
    const html = buildStandaloneHtml("My Doc", "<h1>Hi</h1>", "dark");
    expect(html).toContain("<title>My Doc</title>");
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).toContain("<style>");
  });

  it("escapes the title", () => {
    const html = buildStandaloneHtml('<script>alert(1)</script>', "<p></p>", "light");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("withExtension (pure)", () => {
  it("replaces an existing extension", () => {
    expect(withExtension("notes.md", "html")).toBe("notes.html");
  });

  it("adds an extension when there is none", () => {
    expect(withExtension("notes", "docx")).toBe("notes.docx");
  });

  it("falls back to a default base name when empty", () => {
    expect(withExtension("", "pdf")).toBe("noted.pdf");
  });
});
