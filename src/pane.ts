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
import { docxBlockstoBlob } from "./export/docx";
import { exportJson } from "./export/json";
import { blocksFromElement, blocksFromTokens, type Block } from "./document-model";
import { setupPageMarkers } from "./page-markers";
import { highlighterIcon } from "./icons";
import type { Theme } from "./theme";

export type PaneMode = "view" | "edit";

// 18 pastel highlighter colors (Material "200"-tier shades, chosen for
// consistent lightness so the forced-black text below reads well against
// every one of them). Shown in a popover (see .highlight-popover in
// styles.css) rather than inline - 18 always-visible swatches plus the
// remove option doesn't fit the toolbar row.
const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "#fff59d" },
  { label: "Amber", value: "#ffe082" },
  { label: "Orange", value: "#ffcc80" },
  { label: "Peach", value: "#ffccbc" },
  { label: "Coral", value: "#ffab91" },
  { label: "Red", value: "#ef9a9a" },
  { label: "Rose", value: "#f8bbd0" },
  { label: "Pink", value: "#f48fb1" },
  { label: "Lavender", value: "#d1c4e9" },
  { label: "Purple", value: "#ce93d8" },
  { label: "Indigo", value: "#9fa8da" },
  { label: "Sky", value: "#81d4fa" },
  { label: "Blue", value: "#90caf9" },
  { label: "Cyan", value: "#80deea" },
  { label: "Teal", value: "#80cbc4" },
  { label: "Mint", value: "#a7ffeb" },
  { label: "Green", value: "#a5d6a7" },
  { label: "Lime", value: "#e6ee9c" },
];

// Matches styles.css's --ds-text value for each theme - the text color to
// restore when a highlight is removed, so text goes back to looking
// normal for whichever theme is active rather than a hardcoded color.
const THEME_TEXT_COLOR: Record<Theme, string> = {
  sakura: "#4a0e2e",
  cherry: "#ece7ea",
};

// Forced on any newly-highlighted text, regardless of theme - the pastel
// highlight colors above read poorly against both themes' text colors (in
// a couple of cases even Sakura's own burgundy), so highlighted text
// always gets this near-black color instead of inheriting whatever the
// theme's normal text color is.
const HIGHLIGHTED_TEXT_COLOR = "#1a1a1a";

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
  private exportToggle!: HTMLButtonElement;
  private exportPopover!: HTMLElement;
  private highlightToggle!: HTMLButtonElement;
  private highlightPopover!: HTMLElement;
  private stopPageMarkers!: () => void;
  private stopPopoverListeners: Array<() => void> = [];

  constructor(container: HTMLElement, getTheme: () => Theme) {
    this.id = ++paneCounter;
    this.getTheme = getTheme;
    this.root = document.createElement("div");
    this.root.className = "pane";
    this.root.dataset.paneId = String(this.id);
    container.appendChild(this.root);

    this.render();
    this.wire();
    this.stopPageMarkers = setupPageMarkers(this.root, this.contentEl);
  }

  /** Remove this pane's DOM and let it be garbage collected. */
  destroy(): void {
    this.stopPageMarkers();
    for (const stop of this.stopPopoverListeners) stop();
    this.root.remove();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="pane-toolbar-row">
        <div class="file-controls">
          <button type="button" class="btn browse-btn">Open file&hellip;</button>
          <input type="file" class="file-input" accept=".md,.markdown" hidden />
          <span class="file-name">No file loaded</span>
        </div>
        <div class="tabs" role="tablist">
          <button type="button" class="tab-btn tab-view active" data-mode="view" role="tab" aria-selected="true">Viewer</button>
          <button type="button" class="tab-btn tab-edit" data-mode="edit" role="tab" aria-selected="false">Edit</button>
        </div>
      </div>
      <div class="export-controls">
        <span class="export-group">
          <button type="button" class="btn export-toggle" disabled aria-haspopup="true" aria-expanded="false">Export</button>
          <div class="export-popover" hidden>
            <button type="button" class="btn export-btn" data-export="html">.html</button>
            <button type="button" class="btn export-btn" data-export="pdf">.pdf</button>
            <button type="button" class="btn export-btn" data-export="docx">.docx</button>
            <button type="button" class="btn export-btn" data-export="json">.json</button>
          </div>
        </span>
        <button type="button" class="btn copy-btn" disabled>Copy</button>
      </div>
      <div class="edit-toolbar" hidden>
        <button type="button" class="fmt-btn" data-cmd="bold" title="Bold"><strong>B</strong></button>
        <button type="button" class="fmt-btn" data-cmd="italic" title="Italic"><em>I</em></button>
        <button type="button" class="fmt-btn" data-cmd="underline" title="Underline"><u>U</u></button>
        <button type="button" class="fmt-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
        <span class="highlight-group">
          <button type="button" class="fmt-btn highlight-toggle" title="Highlighter" aria-haspopup="true" aria-expanded="false">${highlighterIcon}</button>
          <div class="highlight-popover" hidden>
            ${HIGHLIGHT_COLORS.map(
              (c) =>
                `<button type="button" class="highlight-swatch" data-highlight="${c.value}" style="background:${c.value}" title="${c.label}" aria-label="${c.label} highlight"></button>`,
            ).join("")}
            <button type="button" class="highlight-swatch highlight-none" data-highlight="none" title="Remove highlight" aria-label="Remove highlight">&times;</button>
          </div>
        </span>
      </div>
      <div class="drop-zone" role="button" tabindex="0">
        <p>Drag &amp; drop a <code>.md</code> file here, click to start a new one, or use "Open file&hellip;" above.</p>
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
    this.exportToggle = this.q<HTMLButtonElement>(".export-toggle");
    this.exportPopover = this.q(".export-popover");
    this.highlightToggle = this.q<HTMLButtonElement>(".highlight-toggle");
    this.highlightPopover = this.q(".highlight-popover");
  }

  private q<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) throw new Error(`Pane: missing element "${selector}"`);
    return el;
  }

  private wire(): void {
    // Registered BEFORE setupFileLoader's own click listener on the same
    // button/event, so stopImmediatePropagation here reliably pre-empts it
    // (same-element listeners run in registration order) - once a file is
    // loaded, a click on this button clears it instead of reopening the
    // file picker underneath.
    this.browseButton.addEventListener("click", (event) => {
      if (this.fileName === null) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      this.clearFile();
    });
    this.browseButton.addEventListener("mouseenter", () => {
      if (this.fileName !== null) this.browseButton.textContent = "Clear file";
    });
    this.browseButton.addEventListener("mouseleave", () => {
      this.browseButton.textContent = "Open file…";
    });

    setupFileLoader(
      { dropZone: this.root, fileInput: this.fileInput, browseButton: this.browseButton },
      (file) => this.load(file),
      (message) => this.notify(message),
    );

    // Clicking (or Enter/Space, since it's a role="button") the empty-state
    // message itself starts a blank new file in Edit mode - drag-and-drop
    // and "Open file…" both load an EXISTING file; this is the third,
    // previously-missing way in ("create one from nothing"). Safe to wire
    // a plain click here: setupFileLoader's drag-and-drop listeners above
    // are bound to `this.root` (the whole pane), not `this.dropZone`
    // itself, so there's no event-type conflict.
    this.dropZone.addEventListener("click", () => this.createNewFile());
    this.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.createNewFile();
      }
    });

    this.tabView.addEventListener("click", () => this.setMode("view"));
    this.tabEdit.addEventListener("click", () => this.setMode("edit"));

    this.copyButton.addEventListener("click", () => void this.copyRawMarkdown());

    this.contentEl.addEventListener("input", () => {
      this.edited = true;
    });

    for (const button of this.root.querySelectorAll<HTMLButtonElement>(".fmt-btn[data-cmd]")) {
      button.addEventListener("click", () => {
        const cmd = button.dataset.cmd;
        if (!cmd) return;
        this.contentEl.focus();
        document.execCommand(cmd);
        this.edited = true;
      });
    }

    const highlightPopoverCtl = this.wirePopover(this.highlightToggle, this.highlightPopover);
    const exportPopoverCtl = this.wirePopover(this.exportToggle, this.exportPopover);
    this.stopPopoverListeners = [highlightPopoverCtl.stop, exportPopoverCtl.stop];

    for (const swatch of this.root.querySelectorAll<HTMLButtonElement>(".highlight-swatch")) {
      swatch.addEventListener("click", () => {
        const isRemove = swatch.dataset.highlight === "none";
        const color = isRemove ? "transparent" : swatch.dataset.highlight!;
        this.contentEl.focus();
        if (!document.execCommand("hiliteColor", false, color)) {
          document.execCommand("backColor", false, color);
        }
        // The pastel highlight colors read poorly against dark/sakura's
        // light default text color - force readable near-black text on a
        // new highlight, and restore the current theme's normal text
        // color on removal (not a hardcoded color - it'd look wrong
        // against a dark-mode/sakura background).
        document.execCommand("foreColor", false, isRemove ? THEME_TEXT_COLOR[this.getTheme()] : HIGHLIGHTED_TEXT_COLOR);
        this.edited = true;
        highlightPopoverCtl.close();
      });
    }

    for (const button of this.exportButtons) {
      button.addEventListener("click", () => {
        exportPopoverCtl.close();
        void this.handleExport(button.dataset.export!);
      });
    }

    this.wireFileNameRename();
  }

  /** Shared open/close-on-outside-click wiring for a toggle-button +
   * popover pair (used by both the highlighter and export popovers, which
   * are otherwise identical in behavior). The outside-click listener is
   * document-level ("outside" includes anywhere else on the page, not just
   * within this pane) - its `stop` must be called from `destroy()` so a
   * discarded pane (dual-window toggling back to single - main.ts)
   * doesn't leave a dangling listener on the shared document. */
  private wirePopover(toggle: HTMLButtonElement, popover: HTMLElement): { close: () => void; stop: () => void } {
    const setOpen = (open: boolean): void => {
      popover.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", (event) => {
      event.stopPropagation(); // don't let this click immediately trigger the outside-click closer below
      setOpen(popover.hidden);
    });
    const onOutsideClick = (event: MouseEvent): void => {
      if (popover.hidden) return;
      if (event.target === toggle || popover.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", onOutsideClick);
    return { close: () => setOpen(false), stop: () => document.removeEventListener("click", onOutsideClick) };
  }

  /** Click the file-name label to rename it in place; clicking anywhere
   * else (blur) confirms. Enter also confirms, Escape cancels. Only
   * active once a file exists (loaded or newly created - createNewFile())
   * - clicking "No file loaded" is a no-op. Mirrors the same contentEditable
   * rename pattern used for widget titles elsewhere (focus + select-all on
   * start, blur-commits, Escape-reverts). */
  private wireFileNameRename(): void {
    let previousName = "";

    const startEditing = (): void => {
      if (this.fileName === null || this.fileNameLabel.contentEditable === "true") return;
      previousName = this.fileName;
      this.fileNameLabel.contentEditable = "true";
      this.fileNameLabel.focus();
      const range = document.createRange();
      range.selectNodeContents(this.fileNameLabel);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    const commitEditing = (): void => {
      this.fileNameLabel.contentEditable = "false";
      const newName = this.fileNameLabel.textContent?.trim() || previousName;
      this.fileName = newName;
      this.fileNameLabel.textContent = newName;
    };

    const cancelEditing = (): void => {
      this.fileNameLabel.contentEditable = "false";
      this.fileNameLabel.textContent = previousName;
    };

    this.fileNameLabel.addEventListener("click", startEditing);
    this.fileNameLabel.addEventListener("keydown", (event) => {
      if (this.fileNameLabel.contentEditable !== "true") return;
      if (event.key === "Enter") {
        event.preventDefault();
        this.fileNameLabel.blur(); // blur listener below runs commitEditing()
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
        this.fileNameLabel.blur();
      }
    });
    this.fileNameLabel.addEventListener("blur", () => {
      if (this.fileNameLabel.contentEditable === "true") commitEditing();
    });
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
    this.exportToggle.disabled = false;
    this.setMode("view");
  }

  /** Starts a blank new file directly in Edit mode - the drop-zone's
   * click-to-create affordance, alongside its existing drag-and-drop and
   * "Open file…" ways to get content into a pane. There's no original
   * Markdown source for a file that didn't come from disk, so `edited`
   * starts true (the live DOM is the only source of truth from the very
   * first keystroke - see buildDocumentModel()), not false like `load()`. */
  private createNewFile(): void {
    this.fileName = "Untitled.md";
    this.rawMarkdown = "";
    this.displayMarkdown = "";
    this.edited = true;
    this.fileNameLabel.textContent = this.fileName;
    this.dropZone.hidden = true;
    this.contentEl.hidden = false;
    this.contentEl.innerHTML = "";
    this.copyButton.disabled = false;
    this.exportToggle.disabled = false;
    this.setMode("edit");
    this.contentEl.focus();
  }

  /** Resets the pane back to its empty, no-file-loaded state - the
   * "Clear file" action the browse button turns into (on hover) once a
   * file is loaded. Mirrors `load()`'s fields/UI toggles in reverse. */
  private clearFile(): void {
    this.fileName = null;
    this.rawMarkdown = "";
    this.displayMarkdown = "";
    this.edited = false;
    this.fileNameLabel.textContent = "No file loaded";
    this.browseButton.textContent = "Open file…";
    this.contentEl.innerHTML = "";
    this.contentEl.hidden = true;
    this.dropZone.hidden = false;
    this.copyButton.disabled = true;
    this.exportToggle.disabled = true;
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
      const blob = await docxBlockstoBlob(this.buildDocumentModel());
      downloadBlob(withExtension(title, "docx"), blob, blob.type);
      return;
    }
    if (format === "json") {
      exportJson(title, this.buildDocumentModel());
      return;
    }
  }

  /** The single place that decides whether the structural exporters
   * (.docx, .json) should read from the original Markdown token tree or
   * from the live edited DOM - see the module doc comment above for why
   * those are the two possible sources. Both exporters need the exact
   * same IR for the exact same reason, so this branch exists exactly
   * once rather than being duplicated per export format. */
  private buildDocumentModel(): Block[] {
    return this.edited ? blocksFromElement(this.contentEl) : blocksFromTokens(lexMarkdown(this.displayMarkdown));
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
