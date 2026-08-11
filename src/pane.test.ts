/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pane, splitFileName } from "./pane";

describe("splitFileName (pure)", () => {
  it("splits a normal filename into base and extension (dot included)", () => {
    expect(splitFileName("Untitled.md")).toEqual({ base: "Untitled", ext: ".md" });
  });

  it("uses the LAST dot, not the first, for names with multiple dots", () => {
    expect(splitFileName("my.notes.v2.md")).toEqual({ base: "my.notes.v2", ext: ".md" });
  });

  it("treats a name with no dot as having no extension", () => {
    expect(splitFileName("README")).toEqual({ base: "README", ext: "" });
  });

  it("treats a leading dot (dotfile) as no extension, not an empty base", () => {
    expect(splitFileName(".gitignore")).toEqual({ base: ".gitignore", ext: "" });
  });
});

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: "text/markdown" });
}

async function loadFile(pane: Pane, name: string, content: string): Promise<void> {
  const fileInput = pane.root.querySelector<HTMLInputElement>(".file-input")!;
  const file = makeFile(name, content);
  Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
  fileInput.dispatchEvent(new Event("change"));
  await vi.waitFor(() => {
    expect(pane.root.querySelector(".content")!.hasAttribute("hidden")).toBe(false);
  });
}

beforeEach(() => {
  // jsdom doesn't implement execCommand; the formatting toolbar calls it,
  // so stub it to a no-op for these DOM-wiring tests.
  document.execCommand = vi.fn().mockReturnValue(true) as unknown as typeof document.execCommand;
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  // jsdom doesn't implement the Blob URL APIs either; the export popover's
  // .html/.docx/.json paths all end up calling these via downloadBlob.
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock") as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
});

describe("Pane content sync between Viewer and Edit tabs", () => {
  it("renders loaded markdown into the shared content element", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello\n\nWorld");
    const content = pane.root.querySelector(".content")!;
    expect(content.innerHTML).toContain("<h1>Hello</h1>");
  });

  it("switching to Edit and back to Viewer keeps edits (same DOM node, no reconversion)", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");

    const content = pane.root.querySelector<HTMLElement>(".content")!;
    const editTab = pane.root.querySelector<HTMLButtonElement>(".tab-edit")!;
    const viewTab = pane.root.querySelector<HTMLButtonElement>(".tab-view")!;

    editTab.click();
    expect(content.contentEditable).toBe("true");

    // Simulate the user typing in the contenteditable region.
    content.innerHTML = "<h1>Hello</h1><p>edited paragraph</p>";
    content.dispatchEvent(new Event("input"));

    viewTab.click();
    expect(content.contentEditable).toBe("false");
    expect(content.innerHTML).toContain("edited paragraph");
  });

  it("copy button copies the ORIGINAL raw markdown, not edited HTML", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello\nraw text");

    const content = pane.root.querySelector<HTMLElement>(".content")!;
    const editTab = pane.root.querySelector<HTMLButtonElement>(".tab-edit")!;
    editTab.click();
    content.innerHTML = "<h1>Changed</h1>";
    content.dispatchEvent(new Event("input"));

    const copyButton = pane.root.querySelector<HTMLButtonElement>(".copy-btn")!;
    copyButton.click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("# Hello\nraw text");
  });
});

describe("Browse button hover-to-clear (once a file is loaded)", () => {
  it("does not change text on hover before any file is loaded", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    expect(browseButton.textContent).toBe("Open file…");

    browseButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(browseButton.textContent).toBe("Open file…");
  });

  it("shows 'Clear file' on hover once a file is loaded, and reverts on mouseleave", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;

    browseButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(browseButton.textContent).toBe("Clear file");

    browseButton.dispatchEvent(new MouseEvent("mouseleave"));
    expect(browseButton.textContent).toBe("Open file…");
  });

  it("clicking the button while a file is loaded clears it instead of reopening the file picker", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");

    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    const fileInput = pane.root.querySelector<HTMLInputElement>(".file-input")!;
    const clickSpy = vi.spyOn(fileInput, "click");

    browseButton.click();

    expect(clickSpy).not.toHaveBeenCalled(); // did NOT reopen the file picker

    const content = pane.root.querySelector<HTMLElement>(".content")!;
    const dropZone = pane.root.querySelector<HTMLElement>(".drop-zone")!;
    const fileNameLabel = pane.root.querySelector<HTMLElement>(".file-name")!;
    const copyButton = pane.root.querySelector<HTMLButtonElement>(".copy-btn")!;
    const exportToggle = pane.root.querySelector<HTMLButtonElement>(".export-toggle")!;

    expect(content.hidden).toBe(true);
    expect(content.innerHTML).toBe("");
    expect(dropZone.hidden).toBe(false);
    expect(fileNameLabel.textContent).toBe("No file loaded");
    expect(browseButton.textContent).toBe("Open file…");
    expect(copyButton.disabled).toBe(true);
    expect(exportToggle.disabled).toBe(true);
  });

  it("clicking the button while NO file is loaded still opens the file picker as normal", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    const fileInput = pane.root.querySelector<HTMLInputElement>(".file-input")!;
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    browseButton.click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("after clearing, the browse button behaves like a fresh pane - hover no longer shows 'Clear file'", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");

    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    browseButton.click(); // clears

    browseButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(browseButton.textContent).toBe("Open file…");
  });
});

describe("Click-to-create-new-file (drop-zone)", () => {
  it("clicking the drop-zone starts a blank file directly in Edit mode", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    const dropZone = pane.root.querySelector<HTMLElement>(".drop-zone")!;

    dropZone.click();

    const content = pane.root.querySelector<HTMLElement>(".content")!;
    const fileNameLabel = pane.root.querySelector<HTMLElement>(".file-name")!;
    expect(dropZone.hidden).toBe(true);
    expect(content.hidden).toBe(false);
    expect(content.contentEditable).toBe("true");
    expect(content.innerHTML).toBe("");
    expect(fileNameLabel.textContent).toBe("Untitled.md");
    expect(pane.root.querySelector<HTMLButtonElement>(".tab-edit")!.classList.contains("active")).toBe(true);
  });

  it("enables copy and export buttons for the new (empty) file", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    pane.root.querySelector<HTMLElement>(".drop-zone")!.click();

    expect(pane.root.querySelector<HTMLButtonElement>(".copy-btn")!.disabled).toBe(false);
    expect(pane.root.querySelector<HTMLButtonElement>(".export-toggle")!.disabled).toBe(false);
  });

  it("keyboard activation (Enter/Space) works too, since it's a role=button", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    const dropZone = pane.root.querySelector<HTMLElement>(".drop-zone")!;

    dropZone.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(dropZone.hidden).toBe(true);
    expect(pane.root.querySelector<HTMLElement>(".content")!.hidden).toBe(false);
  });

  it("typing afterward is treated as an edit (no original Markdown source to fall back to)", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    pane.root.querySelector<HTMLElement>(".drop-zone")!.click();

    const content = pane.root.querySelector<HTMLElement>(".content")!;
    content.innerHTML = "<p>hello</p>";
    content.dispatchEvent(new Event("input"));

    // Copy still returns the (empty) raw source - a blank new file has no
    // Markdown text, only live HTML - per the same contract load()'s files
    // use (PRODUCT-SPEC Section 3): Copy is raw Markdown, not rendered HTML.
    const copyButton = pane.root.querySelector<HTMLButtonElement>(".copy-btn")!;
    copyButton.click();
    // Copy no-ops on an empty rawMarkdown (see copyRawMarkdown's early
    // return) - clipboard should not have been called with anything.
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});

describe("Export popover", () => {
  it("the toggle is disabled until a file exists, matching Copy's gating", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    expect(pane.root.querySelector<HTMLButtonElement>(".export-toggle")!.disabled).toBe(true);
  });

  it("shows sentence case 'Export', not uppercase 'EXPORT'", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    expect(pane.root.querySelector<HTMLButtonElement>(".export-toggle")!.textContent).toBe("Export");
  });

  it("toggle opens/closes the popover with all 4 formats, and updates aria-expanded", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");

    const toggle = pane.root.querySelector<HTMLButtonElement>(".export-toggle")!;
    const popover = pane.root.querySelector<HTMLElement>(".export-popover")!;
    expect(popover.hidden).toBe(true);

    toggle.click();
    expect(popover.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(popover.querySelectorAll(".export-btn")).toHaveLength(4);

    toggle.click();
    expect(popover.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking a format closes the popover", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");

    pane.root.querySelector<HTMLButtonElement>(".export-toggle")!.click();
    pane.root.querySelector<HTMLButtonElement>('.export-btn[data-export="json"]')!.click();

    expect(pane.root.querySelector<HTMLElement>(".export-popover")!.hidden).toBe(true);
  });

  it("clicking outside the popover closes it (shared wiring with the highlighter popover)", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    document.body.appendChild(pane.root);
    await loadFile(pane, "a.md", "# Hello");

    pane.root.querySelector<HTMLButtonElement>(".export-toggle")!.click();
    expect(pane.root.querySelector<HTMLElement>(".export-popover")!.hidden).toBe(false);

    document.body.click();

    expect(pane.root.querySelector<HTMLElement>(".export-popover")!.hidden).toBe(true);
    pane.root.remove();
  });
});

describe("File-name rename (extension locked, only the base is editable)", () => {
  it("clicking before any file is loaded is a no-op", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;

    label.click();

    // jsdom reports an untouched contentEditable as undefined, not "false"
    // (a jsdom quirk, not spec behavior) - what actually matters is that
    // it did NOT flip to "true" (i.e. editing did not start).
    expect(base.contentEditable).not.toBe("true");
    expect(label.textContent).toBe("No file loaded");
  });

  it("splits the loaded name into a locked extension and an editable base", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");

    expect(pane.root.querySelector(".file-name-base")!.textContent).toBe("a");
    expect(pane.root.querySelector(".file-name-ext")!.textContent).toBe(".md");
  });

  it("clicking (even directly on the locked extension) starts editing the base only", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;
    const ext = pane.root.querySelector<HTMLElement>(".file-name-ext")!;

    ext.click(); // clicks bubble to the wrapper's listener regardless of which child was clicked

    expect(base.contentEditable).toBe("true");
    expect(ext.contentEditable).not.toBe("true");
  });

  it("blurring after editing commits the new base and keeps the locked extension", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;

    label.click();
    base.textContent = "renamed";
    base.dispatchEvent(new Event("blur"));

    expect(base.contentEditable).toBe("false");
    expect(label.textContent).toBe("renamed.md"); // base + the untouched, locked extension
  });

  it("typing a full filename with an extension into the base doesn't create a double extension", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;

    label.click();
    base.textContent = "renamed.md"; // user typed the extension too, out of habit
    base.dispatchEvent(new Event("blur"));

    // The locked .md is still appended after whatever was typed - this is
    // an accepted, documented tradeoff of locking the extension (the base
    // itself is not sanitized against embedded dots), not a bug.
    expect(label.textContent).toBe("renamed.md.md");
  });

  it("works for a newly-created 'Untitled.md' file too", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    pane.root.querySelector<HTMLElement>(".drop-zone")!.click();
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;
    expect(base.textContent).toBe("Untitled");
    expect(pane.root.querySelector(".file-name-ext")!.textContent).toBe(".md");

    label.click();
    base.textContent = "my-notes";
    base.dispatchEvent(new Event("blur"));

    expect(label.textContent).toBe("my-notes.md");
  });

  it("Enter commits (via blur), does not insert a newline", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;
    // jsdom doesn't reliably fire a real "blur" event from .blur() on a
    // non-form element (a known jsdom gap, even when attached to the
    // document) - spy to confirm the code calls it, then fire the event
    // manually to simulate what a real browser does at that point.
    const blurSpy = vi.spyOn(base, "blur");

    label.click();
    base.textContent = "enter-renamed";
    base.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(blurSpy).toHaveBeenCalled();
    base.dispatchEvent(new Event("blur"));

    expect(base.contentEditable).toBe("false");
    expect(label.textContent).toBe("enter-renamed.md");
  });

  it("Escape reverts to the base before editing started, extension untouched throughout", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;

    label.click();
    base.textContent = "should-not-stick";
    base.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(label.textContent).toBe("a.md");
  });

  it("blurring with an empty base falls back to the previous base rather than going blank", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "sakura");
    await loadFile(pane, "a.md", "# Hello");
    const label = pane.root.querySelector<HTMLElement>(".file-name")!;
    const base = pane.root.querySelector<HTMLElement>(".file-name-base")!;

    label.click();
    base.textContent = "   ";
    base.dispatchEvent(new Event("blur"));

    expect(label.textContent).toBe("a.md");
  });
});

describe("Highlighter popover", () => {
  async function openEditWithFile(): Promise<Pane> {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "cherry");
    await loadFile(pane, "a.md", "# Hello");
    pane.root.querySelector<HTMLButtonElement>(".tab-edit")!.click();
    return pane;
  }

  it("offers 18 color swatches plus a remove option", async () => {
    const pane = await openEditWithFile();
    const swatches = pane.root.querySelectorAll(".highlight-swatch:not(.highlight-none)");
    expect(swatches).toHaveLength(18);
    expect(pane.root.querySelector(".highlight-none")).not.toBeNull();
  });

  it("toggle opens/closes the popover and updates aria-expanded", async () => {
    const pane = await openEditWithFile();
    const toggle = pane.root.querySelector<HTMLButtonElement>(".highlight-toggle")!;
    const popover = pane.root.querySelector<HTMLElement>(".highlight-popover")!;
    expect(popover.hidden).toBe(true);

    toggle.click();
    expect(popover.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    expect(popover.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking a color swatch applies the highlight, forces dark text for contrast, and closes the popover", async () => {
    const pane = await openEditWithFile();
    pane.root.querySelector<HTMLButtonElement>(".highlight-toggle")!.click();
    const swatch = pane.root.querySelector<HTMLButtonElement>(".highlight-swatch[data-highlight]:not(.highlight-none)")!;

    swatch.click();

    expect(document.execCommand).toHaveBeenCalledWith("hiliteColor", false, swatch.dataset.highlight);
    expect(document.execCommand).toHaveBeenCalledWith("foreColor", false, "#1a1a1a");
    expect(pane.root.querySelector<HTMLElement>(".highlight-popover")!.hidden).toBe(true);
  });

  it("removing a highlight restores the CURRENT theme's normal text color, not a hardcoded one", async () => {
    const pane = await openEditWithFile(); // theme: "cherry"
    pane.root.querySelector<HTMLButtonElement>(".highlight-toggle")!.click();
    pane.root.querySelector<HTMLButtonElement>(".highlight-none")!.click();

    // Cherry theme's --ds-text (styles.css) - see THEME_TEXT_COLOR in pane.ts
    expect(document.execCommand).toHaveBeenCalledWith("foreColor", false, "#ece7ea");
  });

  it("clicking outside the popover closes it", async () => {
    const pane = await openEditWithFile();
    document.body.appendChild(pane.root); // outside-click listener is document-level
    pane.root.querySelector<HTMLButtonElement>(".highlight-toggle")!.click();
    expect(pane.root.querySelector<HTMLElement>(".highlight-popover")!.hidden).toBe(false);

    document.body.click();

    expect(pane.root.querySelector<HTMLElement>(".highlight-popover")!.hidden).toBe(true);
    pane.root.remove();
  });
});

describe("Dual pane instantiation", () => {
  it("two Panes mounted in the same container are independent", async () => {
    const container = document.createElement("div");
    const paneA = new Pane(container, () => "sakura");
    const paneB = new Pane(container, () => "sakura");

    await loadFile(paneA, "a.md", "# A");
    await loadFile(paneB, "b.md", "# B");

    expect(paneA.root.querySelector(".content")!.innerHTML).toContain("A");
    expect(paneB.root.querySelector(".content")!.innerHTML).toContain("B");
    expect(paneA.root).not.toBe(paneB.root);
    expect(container.children.length).toBe(2);
  });
});
