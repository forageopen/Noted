/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import type { LoadedFile } from "./file-loader";
import { isDocxFile, isHtmlFile, isMarkdownFile, isSupportedFile, pickSupportedFile, setupFileLoader } from "./file-loader";

function makeFile(name: string, content: string, type = ""): File {
  return new File([content], name, { type });
}

vi.mock("mammoth/mammoth.browser", () => ({
  default: {
    convertToHtml: vi.fn().mockResolvedValue({
      value: '<p>Hello</p><img src=x onerror="alert(document.domain)">',
    }),
  },
}));

describe("docxToMarkdown (DOM) - sanitizes mammoth's output before it ever touches innerHTML", () => {
  it("strips a malicious event handler mammoth's HTML output would otherwise contain", async () => {
    const { docxToMarkdown } = await import("./file-loader");
    // The exact ArrayBuffer content doesn't matter here - mammoth itself is
    // mocked above to return html containing an onerror handler, simulating
    // what a crafted .docx could produce; this proves docxToMarkdown's own
    // sanitizeHtml() call (src/file-loader.ts) actually runs before that
    // html is assigned to a container's innerHTML.
    const markdown = await docxToMarkdown(new ArrayBuffer(0));
    expect(markdown).not.toContain("onerror");
    expect(markdown).not.toContain("alert(document.domain)");
    expect(markdown).toContain("Hello");
  });
});

describe("htmlToMarkdown (DOM) - sanitizes a loaded .html file before it ever touches innerHTML", () => {
  it("strips a malicious event handler and drops <head>/<script>, keeping body content", async () => {
    const { htmlToMarkdown } = await import("./file-loader");
    const markdown = htmlToMarkdown(
      '<html><head><title>t</title><script>alert(1)</script></head>' +
        '<body><h1>Title</h1><p>Hello</p><img src=x onerror="alert(document.domain)"></body></html>',
    );
    expect(markdown).not.toContain("onerror");
    expect(markdown).not.toContain("alert(document.domain)");
    expect(markdown).not.toContain("alert(1)");
    expect(markdown).toContain("Title");
    expect(markdown).toContain("Hello");
  });
});

describe("isMarkdownFile (pure)", () => {
  it("accepts .md and .markdown", () => {
    expect(isMarkdownFile(makeFile("a.md", ""))).toBe(true);
    expect(isMarkdownFile(makeFile("a.markdown", ""))).toBe(true);
  });

  it("accepts text/markdown mime type regardless of extension", () => {
    expect(isMarkdownFile(makeFile("a.txt", "", "text/markdown"))).toBe(true);
  });

  it("rejects other files", () => {
    expect(isMarkdownFile(makeFile("a.txt", ""))).toBe(false);
    expect(isMarkdownFile(makeFile("a.png", ""))).toBe(false);
  });
});

describe("isDocxFile (pure)", () => {
  it("accepts .docx by extension or mime type", () => {
    expect(isDocxFile(makeFile("a.docx", ""))).toBe(true);
    expect(
      isDocxFile(
        makeFile("a.bin", "", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      ),
    ).toBe(true);
  });

  it("rejects other files", () => {
    expect(isDocxFile(makeFile("a.md", ""))).toBe(false);
  });
});

describe("isHtmlFile (pure)", () => {
  it("accepts .html and .htm by extension or mime type", () => {
    expect(isHtmlFile(makeFile("a.html", ""))).toBe(true);
    expect(isHtmlFile(makeFile("a.htm", ""))).toBe(true);
    expect(isHtmlFile(makeFile("a.bin", "", "text/html"))).toBe(true);
  });

  it("rejects other files", () => {
    expect(isHtmlFile(makeFile("a.md", ""))).toBe(false);
  });
});

describe("isSupportedFile (pure)", () => {
  it("accepts .md, .docx, and .html", () => {
    expect(isSupportedFile(makeFile("a.md", ""))).toBe(true);
    expect(isSupportedFile(makeFile("a.docx", ""))).toBe(true);
    expect(isSupportedFile(makeFile("a.html", ""))).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isSupportedFile(makeFile("a.png", ""))).toBe(false);
  });
});

describe("pickSupportedFile (pure)", () => {
  it("returns the first supported file in a list", () => {
    const files = [makeFile("a.png", ""), makeFile("b.md", "hi")];
    expect(pickSupportedFile(files)?.name).toBe("b.md");
  });

  it("returns a .docx file when that's the first supported one", () => {
    const files = [makeFile("a.png", ""), makeFile("b.docx", "")];
    expect(pickSupportedFile(files)?.name).toBe("b.docx");
  });

  it("returns null when none match", () => {
    expect(pickSupportedFile([makeFile("a.png", "")])).toBeNull();
  });
});

describe("setupFileLoader (jsdom wiring)", () => {
  function setup() {
    const dropZone = document.createElement("div");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    const browseButton = document.createElement("button");
    document.body.append(dropZone, fileInput, browseButton);
    const onLoad = vi.fn();
    const onError = vi.fn();
    setupFileLoader({ dropZone, fileInput, browseButton }, onLoad, onError);
    return { dropZone, fileInput, browseButton, onLoad, onError };
  }

  it("clicking browse triggers the hidden file input", () => {
    const { fileInput, browseButton } = setup();
    const clickSpy = vi.spyOn(fileInput, "click");
    browseButton.click();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("loads a markdown file dropped on the drop zone", async () => {
    const { dropZone, onLoad } = setup();
    const file = makeFile("notes.md", "# Hi");
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
    dropZone.dispatchEvent(event);
    await vi.waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(onLoad).toHaveBeenCalledWith({ name: "notes.md", content: "# Hi" });
  });

  it("reports an error when a non-markdown file is dropped", () => {
    const { dropZone, onError, onLoad } = setup();
    const file = makeFile("image.png", "binary");
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
    dropZone.dispatchEvent(event);
    expect(onError).toHaveBeenCalled();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("loads a markdown file chosen via the file input", async () => {
    const { fileInput, onLoad } = setup();
    const file = makeFile("chosen.md", "content here");
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(onLoad).toHaveBeenCalled());
    expect(onLoad).toHaveBeenCalledWith({ name: "chosen.md", content: "content here" });
  });

  it("loads an .html file dropped on the drop zone, converted to Markdown", async () => {
    const { dropZone, onLoad } = setup();
    const file = makeFile("page.html", "<h1>Title</h1><p>Hello</p>");
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
    dropZone.dispatchEvent(event);
    await vi.waitFor(() => expect(onLoad).toHaveBeenCalled());
    const loaded = onLoad.mock.calls[0]?.[0] as LoadedFile | undefined;
    expect(loaded?.name).toBe("page.html");
    expect(loaded?.content).toContain("# Title");
    expect(loaded?.content).toContain("Hello");
  });
});
