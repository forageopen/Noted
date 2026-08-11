/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { isMarkdownFile, pickMarkdownFile, setupFileLoader } from "./file-loader";

function makeFile(name: string, content: string, type = ""): File {
  return new File([content], name, { type });
}

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

describe("pickMarkdownFile (pure)", () => {
  it("returns the first markdown file in a list", () => {
    const files = [makeFile("a.png", ""), makeFile("b.md", "hi")];
    expect(pickMarkdownFile(files)?.name).toBe("b.md");
  });

  it("returns null when none match", () => {
    expect(pickMarkdownFile([makeFile("a.png", "")])).toBeNull();
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
});
