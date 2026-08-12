import { describe, expect, it } from "vitest";
import { buildStandaloneHtml, withExtension } from "./html";
import type { Theme } from "../theme";

describe("buildStandaloneHtml (pure)", () => {
  it("embeds the title, theme, and body html", () => {
    const html = buildStandaloneHtml("My Doc", "<h1>Hi</h1>", "cherry");
    expect(html).toContain("<title>My Doc</title>");
    expect(html).toContain('data-theme="cherry"');
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).toContain("<style>");
  });

  it("escapes the title", () => {
    const html = buildStandaloneHtml('<script>alert(1)</script>', "<p></p>", "sakura");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("uses the Cherry palette (charcoal bg, neon pink link color), not a fallback", () => {
    const html = buildStandaloneHtml("Doc", "<p>x</p>", "cherry");
    expect(html).toContain('data-theme="cherry"');
    expect(html).toContain("#141316"); // cherry bg
    expect(html).toContain("#ff5ec2"); // cherry link color
  });

  it("uses the Sakura palette (light pink bg, burgundy text)", () => {
    const html = buildStandaloneHtml("Doc", "<p>x</p>", "sakura");
    expect(html).toContain('data-theme="sakura"');
    expect(html).toContain("#fff0f5"); // sakura bg
    expect(html).toContain("#4a0e2e"); // sakura text
  });

  it("has a palette for every theme - doesn't fall through to a default for any of them", () => {
    const themes: Theme[] = ["sakura", "cherry", "forest-brew", "tea-mist", "blueberry", "kokoblu", "dubai"];
    for (const theme of themes) {
      const html = buildStandaloneHtml("Doc", "<p>x</p>", theme);
      expect(html).toContain(`data-theme="${theme}"`);
    }
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
