/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pane } from "./pane";

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
});

describe("Pane content sync between Viewer and Edit tabs", () => {
  it("renders loaded markdown into the shared content element", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "light");
    await loadFile(pane, "a.md", "# Hello\n\nWorld");
    const content = pane.root.querySelector(".content")!;
    expect(content.innerHTML).toContain("<h1>Hello</h1>");
  });

  it("switching to Edit and back to Viewer keeps edits (same DOM node, no reconversion)", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "light");
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
    const pane = new Pane(container, () => "light");
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
    const pane = new Pane(container, () => "light");
    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    expect(browseButton.textContent).toBe("Open file…");

    browseButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(browseButton.textContent).toBe("Open file…");
  });

  it("shows 'Clear file' on hover once a file is loaded, and reverts on mouseleave", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "light");
    await loadFile(pane, "a.md", "# Hello");
    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;

    browseButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(browseButton.textContent).toBe("Clear file");

    browseButton.dispatchEvent(new MouseEvent("mouseleave"));
    expect(browseButton.textContent).toBe("Open file…");
  });

  it("clicking the button while a file is loaded clears it instead of reopening the file picker", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "light");
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
    const exportButtons = pane.root.querySelectorAll<HTMLButtonElement>(".export-btn");

    expect(content.hidden).toBe(true);
    expect(content.innerHTML).toBe("");
    expect(dropZone.hidden).toBe(false);
    expect(fileNameLabel.textContent).toBe("No file loaded");
    expect(browseButton.textContent).toBe("Open file…");
    expect(copyButton.disabled).toBe(true);
    for (const btn of exportButtons) expect(btn.disabled).toBe(true);
  });

  it("clicking the button while NO file is loaded still opens the file picker as normal", () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "light");
    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    const fileInput = pane.root.querySelector<HTMLInputElement>(".file-input")!;
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    browseButton.click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("after clearing, the browse button behaves like a fresh pane - hover no longer shows 'Clear file'", async () => {
    const container = document.createElement("div");
    const pane = new Pane(container, () => "light");
    await loadFile(pane, "a.md", "# Hello");

    const browseButton = pane.root.querySelector<HTMLButtonElement>(".browse-btn")!;
    browseButton.click(); // clears

    browseButton.dispatchEvent(new MouseEvent("mouseenter"));
    expect(browseButton.textContent).toBe("Open file…");
  });
});

describe("Dual pane instantiation", () => {
  it("two Panes mounted in the same container are independent", async () => {
    const container = document.createElement("div");
    const paneA = new Pane(container, () => "light");
    const paneB = new Pane(container, () => "light");

    await loadFile(paneA, "a.md", "# A");
    await loadFile(paneB, "b.md", "# B");

    expect(paneA.root.querySelector(".content")!.innerHTML).toContain("A");
    expect(paneB.root.querySelector(".content")!.innerHTML).toContain("B");
    expect(paneA.root).not.toBe(paneB.root);
    expect(container.children.length).toBe(2);
  });
});
