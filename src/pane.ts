/**
 * src/pane.ts
 *
 * The reusable load/view/edit/export unit. Instantiated once for the
 * single-pane layout, twice (independently) for dual-pane mode.
 *
 * A Pane has two content modes, set by the loaded file's `LoadedFileFormat`
 * (`this.contentFormat`) and never mixed:
 *
 * --- "markdown" mode: Content-sync design (Viewer <-> Edit tabs) ------
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
 * Separately, `this.rawContent` holds the *original* file content
 * exactly as loaded, untouched by edits. That's what the Copy button
 * copies ("copies the loaded file's raw content" - PRODUCT-SPEC
 * Section 3), and what feeds the docx exporter's `marked.lexer()` path
 * when the user hasn't edited anything yet (see src/export/docx.ts).
 *
 * --- "html" mode: sandboxed live viewer, view-only ---------------------
 *
 * A loaded .html file is rendered live - CSS/SVG/JS animation intact -
 * into `this.contentFrame`, a `<iframe sandbox="allow-scripts">` whose
 * `srcdoc` is the file's raw, unmodified, *unsanitized* bytes (see
 * file-loader.ts's module doc comment and PRODUCT-DECISIONS.md ADR-011
 * for why this supersedes the original Markdown-flattening approach).
 * Deliberately never touches `contentEl.innerHTML` - the sandbox
 * attribute's lack of `allow-same-origin` is the actual security
 * boundary here, not sanitization; the loaded document runs in an opaque
 * origin that cannot read or write anything in Noted's own page. No Edit
 * tab (`this.tabEdit` disabled) and only `.html` export is enabled
 * (re-download of the original bytes) - there's no lossless way to fold
 * arbitrary HTML+JS into Markdown/.docx/.json, and doing so lossily would
 * defeat the entire point of loading it as HTML.
 */

import { renderMarkdown, lexMarkdown, stripFrontmatter } from "./markdown";
import { setupFileLoader, type LoadedFile, type LoadedFileFormat } from "./file-loader";
import { exportHtml, withExtension, downloadBlob } from "./export/html";
import { docxBlockstoBlob } from "./export/docx";
import { exportJson } from "./export/json";
import { blocksFromElement, blocksFromTokens, type Block } from "./document-model";
import { setupPageMarkers } from "./page-markers";
import { setupTypingEffects } from "./typing-effects";
import { highlighterIcon, headingIcon } from "./icons";
import type { Theme } from "./theme";

export type PaneMode = "view" | "edit";

/** Pure: splits a filename into its base and extension (extension includes
 * the leading dot, e.g. "Untitled.md" -> { base: "Untitled", ext: ".md" }).
 * A name with no dot (or a dot only as the very first character, e.g. a
 * dotfile) has no extension - the whole thing is the base. Only the base
 * half is ever user-editable (see wireFileNameRename) - the extension
 * stays locked so a rename can't accidentally drop or corrupt it. */
export function splitFileName(name: string): { base: string; ext: string } {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) };
}

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

// Paragraph-style popover entries (edit toolbar) - H1-H3 plus Body (normal
// paragraph text), matching Obsidian's font-size/paragraph-style setting.
// `block` is the tag name passed to execCommand("formatBlock", ...);
// `previewSize` renders each button's own label at roughly its real
// relative size, same as Obsidian's dropdown, so the list itself doubles
// as a size preview rather than identically-sized text buttons.
const PARAGRAPH_STYLES = [
  { label: "H1", block: "H1", previewSize: "1.3em" },
  { label: "H2", block: "H2", previewSize: "1.2em" },
  { label: "H3", block: "H3", previewSize: "1.1em" },
  { label: "Body", block: "P", previewSize: "0.85em" },
];

// Matches styles.css's --ds-text value for each theme - the text color to
// restore when a highlight is removed, so text goes back to looking
// normal for whichever theme is active rather than a hardcoded color.
const THEME_TEXT_COLOR: Record<Theme, string> = {
  sakura: "#4a0e2e",
  cherry: "#ece7ea",
  "forest-brew": "#acc54e",
  "tea-mist": "#242f21",
  blueberry: "#babcd3",
  kokoblu: "#a7bdd7",
  dubai: "#abc44f",
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

  private rawContent = "";
  /** rawContent with any leading YAML frontmatter block stripped - this,
   * not rawContent, is what gets rendered/edited/docx-exported in
   * "markdown" mode. The frontmatter (doc_id, tags, etc.) is tooling
   * metadata, not content a reader wants to see - the file name is
   * already shown separately. rawContent itself stays untouched since
   * Copy's contract is the literal, unmodified file content (PRODUCT-SPEC
   * Section 3). Unused in "html" mode (see module doc comment). */
  private displayMarkdown = "";
  private fileName: string | null = null;
  private mode: PaneMode = "view";
  private contentFormat: LoadedFileFormat = "markdown";
  private edited = false;
  private getTheme: () => Theme;

  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private browseButton!: HTMLButtonElement;
  private copyButton!: HTMLButtonElement;
  private fileNameLabel!: HTMLElement;
  private fileNameBase!: HTMLElement;
  private fileNameExt!: HTMLElement;
  private tabView!: HTMLButtonElement;
  private tabEdit!: HTMLButtonElement;
  private editToolbar!: HTMLElement;
  private contentEl!: HTMLElement;
  private contentFrame!: HTMLIFrameElement;
  private exportButtons!: HTMLButtonElement[];
  private exportToggle!: HTMLButtonElement;
  private exportPopover!: HTMLElement;
  private highlightToggle!: HTMLButtonElement;
  private highlightPopover!: HTMLElement;
  private paragraphStyleToggle!: HTMLButtonElement;
  private paragraphStylePopover!: HTMLElement;
  private stopPageMarkers!: () => void;
  private stopTypingEffects!: () => void;
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
    this.stopTypingEffects = setupTypingEffects(this.contentEl);
  }

  /** Remove this pane's DOM and let it be garbage collected. */
  destroy(): void {
    this.stopPageMarkers();
    this.stopTypingEffects();
    for (const stop of this.stopPopoverListeners) stop();
    this.root.remove();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="pane-toolbar-row">
        <div class="file-controls">
          <button type="button" class="btn browse-btn">Open file&hellip;</button>
          <input type="file" class="file-input" accept=".md,.markdown,.docx,.html,.htm" hidden />
          <span class="file-name"><span class="file-name-base">No file loaded</span><span class="file-name-ext"></span></span>
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
            <button type="button" class="btn export-btn" data-export="md">.md</button>
            <button type="button" class="btn export-btn" data-export="json">.json</button>
          </div>
        </span>
        <button type="button" class="btn copy-btn" disabled>Copy</button>
      </div>
      <div class="edit-toolbar" hidden>
        <span class="paragraph-style-group">
          <button type="button" class="fmt-btn paragraph-style-toggle" title="Paragraph style" aria-haspopup="true" aria-expanded="false">${headingIcon}</button>
          <div class="paragraph-style-popover" hidden>
            ${PARAGRAPH_STYLES.map(
              (s) =>
                `<button type="button" class="paragraph-style-btn" data-block="${s.block}" style="font-size:${s.previewSize}">${s.label}</button>`,
            ).join("")}
          </div>
        </span>
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
        <p>Drag &amp; drop a <code>.md</code>, <code>.docx</code>, or <code>.html</code> file here, click to start a new one, or use "Open file&hellip;" above.</p>
      </div>
      <div class="content" hidden></div>
      <iframe class="content-frame" title="HTML preview" sandbox="allow-scripts" hidden></iframe>
    `;

    this.dropZone = this.q(".drop-zone");
    this.fileInput = this.q<HTMLInputElement>(".file-input");
    this.browseButton = this.q<HTMLButtonElement>(".browse-btn");
    this.copyButton = this.q<HTMLButtonElement>(".copy-btn");
    this.fileNameLabel = this.q(".file-name");
    this.fileNameBase = this.q(".file-name-base");
    this.fileNameExt = this.q(".file-name-ext");
    this.tabView = this.q<HTMLButtonElement>(".tab-view");
    this.tabEdit = this.q<HTMLButtonElement>(".tab-edit");
    this.editToolbar = this.q(".edit-toolbar");
    this.contentEl = this.q(".content");
    this.contentFrame = this.q<HTMLIFrameElement>(".content-frame");
    this.exportButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>(".export-btn"));
    this.exportToggle = this.q<HTMLButtonElement>(".export-toggle");
    this.exportPopover = this.q(".export-popover");
    this.highlightToggle = this.q<HTMLButtonElement>(".highlight-toggle");
    this.highlightPopover = this.q(".highlight-popover");
    this.paragraphStyleToggle = this.q<HTMLButtonElement>(".paragraph-style-toggle");
    this.paragraphStylePopover = this.q(".paragraph-style-popover");
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

    this.copyButton.addEventListener("click", () => void this.copyRawContent());

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
    const paragraphStylePopoverCtl = this.wirePopover(this.paragraphStyleToggle, this.paragraphStylePopover);
    this.stopPopoverListeners = [highlightPopoverCtl.stop, exportPopoverCtl.stop, paragraphStylePopoverCtl.stop];

    for (const button of this.root.querySelectorAll<HTMLButtonElement>(".paragraph-style-btn")) {
      button.addEventListener("click", () => {
        const block = button.dataset.block;
        if (!block) return;
        this.contentEl.focus();
        document.execCommand("formatBlock", false, block);
        this.edited = true;
        paragraphStylePopoverCtl.close();
      });
    }

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

  /** Click the file-name (base or extension - the wrapper) to rename it in
   * place; clicking anywhere else (blur) confirms. Enter also confirms,
   * Escape cancels. Only active once a file exists (loaded or newly
   * created - createNewFile()) - clicking "No file loaded" is a no-op.
   *
   * Only the base name (`.file-name-base`) is ever editable - the
   * extension (`.file-name-ext`) is locked, always re-appended on commit,
   * so renaming "Untitled.md" can't accidentally drop or corrupt the
   * ".md". Mirrors the same contentEditable rename pattern used for
   * widget titles elsewhere (focus + select-all on start, blur-commits,
   * Escape-reverts). */
  private wireFileNameRename(): void {
    let previousBase = "";

    const startEditing = (): void => {
      if (this.fileName === null || this.fileNameBase.contentEditable === "true") return;
      previousBase = splitFileName(this.fileName).base;
      this.fileNameBase.contentEditable = "true";
      this.fileNameBase.focus();
      const range = document.createRange();
      range.selectNodeContents(this.fileNameBase);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    const commitEditing = (): void => {
      this.fileNameBase.contentEditable = "false";
      const newBase = this.fileNameBase.textContent?.trim() || previousBase;
      this.fileNameBase.textContent = newBase;
      this.fileName = `${newBase}${this.fileNameExt.textContent ?? ""}`;
    };

    const cancelEditing = (): void => {
      this.fileNameBase.contentEditable = "false";
      this.fileNameBase.textContent = previousBase;
    };

    // Click anywhere on the wrapper (including over the locked extension)
    // starts editing the base - only the base itself ever becomes
    // contentEditable, so this can't be tricked into editing the extension.
    this.fileNameLabel.addEventListener("click", startEditing);
    this.fileNameBase.addEventListener("keydown", (event) => {
      if (this.fileNameBase.contentEditable !== "true") return;
      if (event.key === "Enter") {
        event.preventDefault();
        this.fileNameBase.blur(); // blur listener below runs commitEditing()
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
        this.fileNameBase.blur();
      }
    });
    this.fileNameBase.addEventListener("blur", () => {
      if (this.fileNameBase.contentEditable === "true") commitEditing();
    });
  }

  private notify(message: string): void {
    // Minimal, dependency-free feedback; a toast system is out of scope for v1.
    window.alert(message);
  }

  private load(file: LoadedFile): void {
    this.fileName = file.name;
    this.rawContent = file.content;
    this.contentFormat = file.format;
    this.edited = false;
    this.renderFileName();
    this.dropZone.hidden = true;

    if (file.format === "html") {
      // See module doc comment - deliberately never touches
      // contentEl.innerHTML with this content; the sandboxed iframe (no
      // allow-same-origin) is the security boundary, not sanitization.
      this.displayMarkdown = "";
      this.contentEl.hidden = true;
      this.contentEl.innerHTML = "";
      this.contentFrame.hidden = false;
      this.contentFrame.srcdoc = file.content;
      this.tabEdit.disabled = true;
    } else {
      this.displayMarkdown = stripFrontmatter(file.content);
      this.contentFrame.hidden = true;
      this.contentFrame.removeAttribute("srcdoc");
      this.contentEl.hidden = false;
      this.contentEl.innerHTML = renderMarkdown(this.displayMarkdown);
      this.tabEdit.disabled = false;
    }

    this.copyButton.disabled = false;
    this.exportToggle.disabled = false;
    this.updateExportButtons();
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
    this.rawContent = "";
    this.displayMarkdown = "";
    this.contentFormat = "markdown";
    this.edited = true;
    this.renderFileName();
    this.dropZone.hidden = true;
    this.contentFrame.hidden = true;
    this.contentFrame.removeAttribute("srcdoc");
    this.contentEl.hidden = false;
    this.contentEl.innerHTML = "";
    this.tabEdit.disabled = false;
    this.copyButton.disabled = false;
    this.exportToggle.disabled = false;
    this.updateExportButtons();
    this.setMode("edit");
    this.contentEl.focus();
  }

  /** Resets the pane back to its empty, no-file-loaded state - the
   * "Clear file" action the browse button turns into (on hover) once a
   * file is loaded. Mirrors `load()`'s fields/UI toggles in reverse. */
  private clearFile(): void {
    this.fileName = null;
    this.rawContent = "";
    this.displayMarkdown = "";
    this.contentFormat = "markdown";
    this.edited = false;
    this.fileNameBase.textContent = "No file loaded";
    this.fileNameExt.textContent = "";
    this.browseButton.textContent = "Open file…";
    this.contentEl.innerHTML = "";
    this.contentEl.hidden = true;
    this.contentFrame.hidden = true;
    this.contentFrame.removeAttribute("srcdoc");
    this.tabEdit.disabled = false;
    this.dropZone.hidden = false;
    this.copyButton.disabled = true;
    this.exportToggle.disabled = true;
    this.updateExportButtons();
    this.setMode("view");
  }

  /** Renders `this.fileName` into the base/extension split (splitFileName)
   * - called from load()/createNewFile(), not clearFile() (which has no
   * real filename to split, just the "No file loaded" placeholder). */
  private renderFileName(): void {
    if (this.fileName === null) return;
    const { base, ext } = splitFileName(this.fileName);
    this.fileNameBase.textContent = base;
    this.fileNameExt.textContent = ext;
  }

  private setMode(mode: PaneMode): void {
    // "html" mode has no Edit tab (this.tabEdit is disabled, which already
    // blocks the click that would normally get here) - guarded again here
    // against any other/future caller.
    if (mode === "edit" && this.contentFormat === "html") return;
    this.mode = mode;
    const isEdit = mode === "edit";
    this.contentEl.contentEditable = isEdit ? "true" : "false";
    this.editToolbar.hidden = !isEdit;
    this.tabView.classList.toggle("active", !isEdit);
    this.tabEdit.classList.toggle("active", isEdit);
    this.tabView.setAttribute("aria-selected", String(!isEdit));
    this.tabEdit.setAttribute("aria-selected", String(isEdit));
  }

  private async copyRawContent(): Promise<void> {
    if (!this.rawContent) return;
    try {
      await navigator.clipboard.writeText(this.rawContent);
      this.flashCopied();
    } catch {
      this.notify("Could not copy to clipboard.");
    }
  }

  /** "html" mode only allows re-downloading the original bytes as .html -
   * no Edit tab, no lossless way to fold arbitrary HTML+JS into
   * Markdown/.docx/.json (see module doc comment) - so every other export
   * button is disabled while an "html"-format file is loaded. */
  private updateExportButtons(): void {
    const htmlOnly = this.contentFormat === "html";
    for (const button of this.exportButtons) {
      button.disabled = htmlOnly && button.dataset.export !== "html";
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
    // Defense in depth alongside updateExportButtons() disabling the
    // buttons themselves - see that method's doc comment.
    if (this.contentFormat === "html" && format !== "html") return;
    const title = this.fileName.replace(/\.[^./\\]+$/, "");
    if (format === "html") {
      if (this.contentFormat === "html") {
        if (!this.rawContent) return;
        downloadBlob(withExtension(title, "html"), this.rawContent, "text/html");
      } else {
        exportHtml(title, this.contentEl.innerHTML, this.getTheme());
      }
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
    if (format === "md") {
      // No adapter needed - this IS already Markdown, just written to a
      // file instead of the clipboard. Same contract as the Copy button
      // (PRODUCT-SPEC Section 3: raw Markdown, not rendered/edited HTML)
      // and the same limitation: if the pane has been edited, those edits
      // live only in the DOM (see the module doc comment), so this can
      // only ever export the ORIGINAL loaded text, not the edited result -
      // reconstructing Markdown from edited HTML is explicitly out of
      // scope. No-ops on an empty rawContent (a brand new, never-loaded
      // file), same as Copy.
      if (!this.rawContent) return;
      downloadBlob(withExtension(title, "md"), this.rawContent, "text/markdown");
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
