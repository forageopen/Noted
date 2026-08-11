/**
 * src/pane.ts
 *
 * The reusable load/view/edit/export unit. Instantiated once for the
 * single-pane layout, twice (independently) for dual-pane mode.
 *
 * --- Content-sync design (Viewer <-> Edit tabs) -----------------------
 *
 * Source of truth: **rendered HTML**, held in one DOM node (`this.contentEl`).
 *
 * The Viewer and Edit tabs are NOT two separate representations that get
 * converted back and forth - they are the *same* `contentEl`, with only
 * its `contentEditable` attribute (and toolbar visibility) toggled
 * between the two modes. That makes "switching tabs must not lose
 * content, and edits in one must show in the other" true by
 * construction: there is only ever one copy of the content in memory,
 * so there is nothing to lose or resync.
 *
 * HTML was chosen over Markdown-as-source-of-truth because the Edit
 * tab's formatting tools are `document.execCommand` (bold/italic/
 * underline/strike/highlight), which mutate HTML directly - there is no
 * `execCommand` that edits Markdown text. Re-serializing edited HTML
 * back into Markdown on every keystroke would be lossy and is out of
 * scope for v1.
 *
 * Separately, `this.rawMarkdown` holds the *original* file content
 * exactly as loaded, untouched by edits. That's what the Copy button
 * copies ("copies the loaded file's raw Markdown content" - PRODUCT-SPEC
 * Section 3), and what feeds the docx exporter's `marked.lexer()` path
 * when the user hasn't edited anything yet (see src/export/docx.ts).
 */

import { renderMarkdown, lexMarkdown, stripFrontmatter } from "./markdown";
import { setupFileLoader, type LoadedFile } from "./file-loader";
import { exportHtml, withExtension, downloadBlob } from "./export/html";
import { tokensToBlocks, elementToBlocks, docxBlockstoBlob } from "./export/docx";
import type { Theme } from "./theme";

export type PaneMode = "view" | "edit";

const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "#fff59d" },
  { label: "Green", value: "#a5d6a7" },
  { label: "Blue", value: "#90caf9" },
  { label: "Pink", value: "#f48fb1" },
];

let paneCounter = 0;

export class Pane {
  readonly id: number;
  readonly root: HTMLElement;

  private rawMarkdown = "";
  /** rawMarkdown with any leading YAML frontmatter block stripped - this,
   * not rawMarkdown, is what gets rendered/edited/docx-exported. The
   * frontmatter (doc_id, tags, etc.) is tooling metadata, not content a
   * reader wants to see - the file name is already shown separately.
   * rawMarkdown itself stays untouched since Copy's contract is the
   * literal, unmodified file content (PRODUCT-SPEC Section 3). */
  private displayMarkdown = "";
  private fileName: string | null = null;
  private mode: PaneMode = "view";
  private edited = false;
  private getTheme: () => Theme;

  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private browseButton!: HTMLButtonElement;
  private copyButton!: HTMLButtonElement;
  private fileNameLabel!: HTMLElement;
  private tabView!: HTMLButtonElement;
  private tabEdit!: HTMLButtonElement;
  private editToolbar!: HTMLElement;
  private contentEl!: HTMLElement;
  private exportButtons!: HTMLButtonElement[];

  constructor(container: HTMLElement, getTheme: () => Theme) {
    this.id = ++paneCounter;
    this.getTheme = getTheme;
    this.root = document.createElement("div");
    this.root.className = "pane";
    this.root.dataset.paneId = String(this.id);
    container.appendChild(this.root);

    this.render();
    this.wire();
  }

  /** Remove this pane's DOM and let it be garbage collected. */
  destroy(): void {
    this.root.remove();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="pane-toolbar-row">
        <div class="file-controls">
          <button type="button" class="btn browse-btn">Open file&hellip;</button>
          <input type="file" class="file-input" accept=".md,.markdown" hidden />
          <span class="file-name">No file loaded</span>
          <button type="button" class="btn copy-btn" disabled>Copy</button>
        </div>
        <div class="tabs" role="tablist">
          <button type="button" class="tab-btn tab-view active" data-mode="view" role="tab" aria-selected="true">Viewer</button>
          <button type="button" class="tab-btn tab-edit" data-mode="edit" role="tab" aria-selected="false">Edit</button>
        </div>
      </div>
      <div class="export-controls">
        <span class="export-label">Export:</span>
        <button type="button" class="btn export-btn" data-export="html" disabled>.html</button>
        <button type="button" class="btn export-btn" data-export="pdf" disabled>.pdf</button>
        <button type="button" class="btn export-btn" data-export="docx" disabled>.docx</button>
      </div>
      <div class="edit-toolbar" hidden>
        <button type="button" class="fmt-btn" data-cmd="bold" title="Bold"><strong>B</strong></button>
        <button type="button" class="fmt-btn" data-cmd="italic" title="Italic"><em>I</em></button>
        <button type="button" class="fmt-btn" data-cmd="underline" title="Underline"><u>U</u></button>
        <button type="button" class="fmt-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
        <span class="highlight-group">
          ${HIGHLIGHT_COLORS.map(
            (c) =>
              `<button type="button" class="highlight-swatch" data-highlight="${c.value}" style="background:${c.value}" title="${c.label} highlight" aria-label="${c.label} highlight"></button>`,
          ).join("")}
          <button type="button" class="highlight-swatch highlight-none" data-highlight="none" title="Remove highlight" aria-label="Remove highlight">&times;</button>
        </span>
      </div>
      <div class="drop-zone">
        <p>Drag &amp; drop a <code>.md</code> file here, or use "Open file&hellip;" above.</p>
      </div>
      <div class="content" hidden></div>
    `;

    this.dropZone = this.q(".drop-zone");
    this.fileInput = this.q<HTMLInputElement>(".file-input");
    this.browseButton = this.q<HTMLButtonElement>(".browse-btn");
    this.copyButton = this.q<HTMLButtonElement>(".copy-btn");
    this.fileNameLabel = this.q(".file-name");
    this.tabView = this.q<HTMLButtonElement>(".tab-view");
    this.tabEdit = this.q<HTMLButtonElement>(".tab-edit");
    this.editToolbar = this.q(".edit-toolbar");
    this.contentEl = this.q(".content");
    this.exportButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>(".export-btn"));
  }

  private q<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) throw new Error(`Pane: missing element "${selector}"`);
    return el;
  }

  private wire(): void {
    setupFileLoader(
      { dropZone: this.root, fileInput: this.fileInput, browseButton: this.browseButton },
      (file) => this.load(file),
      (message) => this.notify(message),
    );

    this.tabView.addEventListener("click", () => this.setMode("view"));
    this.tabEdit.addEventListener("click", () => this.setMode("edit"));

    this.copyButton.addEventListener("click", () => void this.copyRawMarkdown());

    this.contentEl.addEventListener("input", () => {
      this.edited = true;
    });

    for (const button of this.root.querySelectorAll<HTMLButtonElement>(".fmt-btn")) {
      button.addEventListener("click", () => {
        const cmd = button.dataset.cmd;
        if (!cmd) return;
        this.contentEl.focus();
        document.execCommand(cmd);
        this.edited = true;
      });
    }

    for (const swatch of this.root.querySelectorAll<HTMLButtonElement>(".highlight-swatch")) {
      swatch.addEventListener("click", () => {
        const color = swatch.dataset.highlight === "none" ? "transparent" : swatch.dataset.highlight!;
        this.contentEl.focus();
        if (!document.execCommand("hiliteColor", false, color)) {
          document.execCommand("backColor", false, color);
        }
        this.edited = true;
      });
    }

    for (const button of this.exportButtons) {
      button.addEventListener("click", () => void this.handleExport(button.dataset.export!));
    }
  }

  private notify(message: string): void {
    // Minimal, dependency-free feedback; a toast system is out of scope for v1.
    window.alert(message);
  }

  private load(file: LoadedFile): void {
    this.fileName = file.name;
    this.rawMarkdown = file.content;
    this.displayMarkdown = stripFrontmatter(file.content);
    this.edited = false;
    this.fileNameLabel.textContent = file.name;
    this.dropZone.hidden = true;
    this.contentEl.hidden = false;
    this.contentEl.innerHTML = renderMarkdown(this.displayMarkdown);
    this.copyButton.disabled = false;
    for (const button of this.exportButtons) button.disabled = false;
    this.setMode("view");
  }

  private setMode(mode: PaneMode): void {
    this.mode = mode;
    const isEdit = mode === "edit";
    this.contentEl.contentEditable = isEdit ? "true" : "false";
    this.editToolbar.hidden = !isEdit;
    this.tabView.classList.toggle("active", !isEdit);
    this.tabEdit.classList.toggle("active", isEdit);
    this.tabView.setAttribute("aria-selected", String(!isEdit));
    this.tabEdit.setAttribute("aria-selected", String(isEdit));
  }

  private async copyRawMarkdown(): Promise<void> {
    if (!this.rawMarkdown) return;
    try {
      await navigator.clipboard.writeText(this.rawMarkdown);
      this.flashCopied();
    } catch {
      this.notify("Could not copy to clipboard.");
    }
  }

  private flashCopied(): void {
    const original = this.copyButton.textContent;
    this.copyButton.textContent = "Copied";
    window.setTimeout(() => {
      this.copyButton.textContent = original ?? "Copy";
    }, 1500);
  }

  private async handleExport(format: string): Promise<void> {
    if (!this.fileName) return;
    const title = this.fileName.replace(/\.[^./\\]+$/, "");
    if (format === "html") {
      exportHtml(title, this.contentEl.innerHTML, this.getTheme());
      return;
    }
    if (format === "pdf") {
      this.printPane();
      return;
    }
    if (format === "docx") {
      const blocks = this.edited ? elementToBlocks(this.contentEl) : tokensToBlocks(lexMarkdown(this.displayMarkdown));
      const blob = await docxBlockstoBlob(blocks);
      downloadBlob(withExtension(title, "docx"), blob, blob.type);
      return;
    }
  }

  private printPane(): void {
    document.body.classList.add("noted-printing");
    this.root.classList.add("noted-print-target");
    const cleanup = () => {
      document.body.classList.remove("noted-printing");
      this.root.classList.remove("noted-print-target");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }
}
