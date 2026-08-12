/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeHtml('<p>hello</p><script>alert(document.domain)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(document.domain)");
    expect(out).toContain("<p>hello</p>");
  });

  it("strips event handler attributes (onerror, onload, etc.)", () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(document.domain)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("strips javascript: URIs from links", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click me</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips <iframe> embeds", () => {
    const out = sanitizeHtml('<iframe src="https://evil.example/"></iframe>');
    expect(out).not.toContain("<iframe");
  });

  it("preserves ordinary formatting/structural markup untouched", () => {
    const out = sanitizeHtml("<h1>Title</h1><p><strong>bold</strong> and <em>italic</em></p><ul><li>item</li></ul>");
    expect(out).toContain("<h1>Title</h1>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<li>item</li>");
  });

  it("preserves a normal https link and its href", () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(out).toContain('href="https://example.com"');
  });

  it("preserves a normal image's src", () => {
    const out = sanitizeHtml('<img src="https://example.com/pic.png" alt="pic">');
    expect(out).toContain('src="https://example.com/pic.png"');
  });
});
