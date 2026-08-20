/**
 * src/file-loader.ts
 *
 * Loading a .md, .docx, or .html file, either via drag-and-drop onto a drop
 * zone or via a hidden <input type=file> triggered by a visible "browse"
 * button.
 *
 * Two different downstream representations, tagged by `LoadedFile.format`:
 *  - "markdown": a .md file's text as-is, or a .docx converted to Markdown
 *    on load (docx -> HTML via mammoth -> shared IR via `blocksFromElement`
 *    -> Markdown via `blocksToMarkdown`, see src/document-model.ts). Pane
 *    renders this into its `contentEl` (viewable AND editable - see
 *    pane.ts's module doc comment).
 *  - "html": a .html file's raw text, completely unmodified and
 *    *unsanitized* - see PRODUCT-DECISIONS.md ADR-011 for why flattening
 *    it to Markdown (the original ADR-010 approach) was superseded: it
 *    threw away exactly what makes a hand-authored .html file worth
 *    opening as HTML in the first place (CSS/SVG/JS-driven animation,
 *    layout). Pane renders this into a sandboxed `<iframe sandbox=
 *    "allow-scripts">` via `srcdoc` instead of `contentEl.innerHTML` -
 *    the iframe's lack of `allow-same-origin` is what makes it safe to
 *    skip sanitization here (an opaque-origin iframe can't read/write
 *    anything in Noted's own origin no matter what the loaded HTML
 *    contains), view-only (no Edit tab), and .html-export-only (re-download
 *    of the original bytes; no meaningful way to flatten arbitrary HTML+JS
 *    back into Markdown/.docx/.json without losing the point of loading it
 *    as HTML at all).
 *
 * Pure logic (isSupportedFile, pickSupportedFile) is kept separate from the
 * DOM wiring (setupFileLoader) so it's unit-testable without simulating
 * real drag events end to end.
 */

import mammoth from "mammoth/mammoth.browser";
import { blocksFromElement, blocksToMarkdown } from "./document-model";
import { sanitizeHtml } from "./sanitize";

export type LoadedFileFormat = "markdown" | "html";

export interface LoadedFile {
  name: string;
  content: string;
  format: LoadedFileFormat;
}

/** Pure: does this File look like a Markdown file? */
export function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || file.type === "text/markdown";
}

/** Pure: does this File look like a Word .docx file? */
export function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

/** Pure: does this File look like an HTML file? */
export function isHtmlFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".html") || name.endsWith(".htm") || file.type === "text/html";
}

/** Pure: does this File look like a file Noted knows how to load? */
export function isSupportedFile(file: File): boolean {
  return isMarkdownFile(file) || isDocxFile(file) || isHtmlFile(file);
}

/** Pure: pick the first loadable (.md or .docx) file out of a FileList/array, or null. */
export function pickSupportedFile(files: Iterable<File>): File | null {
  for (const file of files) {
    if (isSupportedFile(file)) return file;
  }
  return null;
}

/** Read a File's contents as text. */
export function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // FileReader.result's declared type (string | ArrayBuffer | null) covers
    // every read method, not just this one - readAsText() below guarantees
    // it's actually string | null here, so this asserts the real invariant
    // rather than coercing a value that could in principle be an ArrayBuffer
    // (String(anArrayBuffer) would silently produce "[object ArrayBuffer]").
    reader.onload = () => resolve((reader.result as string | null) ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/** Read a File's contents as an ArrayBuffer (needed for mammoth's .docx parsing). */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/** Convert a .docx file's raw bytes into Markdown text via mammoth (docx ->
 * HTML) + the shared document IR (HTML -> IR -> Markdown). Best-effort, not
 * lossless - see the module doc comment on `blocksToMarkdown`. Sanitized
 * before it ever touches innerHTML - see sanitize.ts's header comment for
 * why this can't wait until a later step (event handler attributes like
 * onerror can fire the moment they're assigned, independent of whether
 * this detached container ever reaches a live, on-screen document). */
export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const container = document.createElement("div");
  container.innerHTML = sanitizeHtml(html);
  return blocksToMarkdown(blocksFromElement(container));
}

export interface FileLoaderElements {
  dropZone: HTMLElement;
  fileInput: HTMLInputElement;
  browseButton: HTMLButtonElement;
}

/**
 * Wire drag-and-drop + click-to-browse loading onto the given elements.
 * Calls onLoad(name, content) once a valid Markdown file is read; calls
 * onError(message) if a dropped/selected file isn't Markdown or fails to read.
 */
export function setupFileLoader(
  elements: FileLoaderElements,
  onLoad: (file: LoadedFile) => void,
  onError: (message: string) => void = () => {},
): void {
  const { dropZone, fileInput, browseButton } = elements;

  browseButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files ? pickSupportedFile(fileInput.files) : null;
    if (file) {
      void loadAndEmit(file, onLoad, onError);
    } else if (fileInput.files && fileInput.files.length > 0) {
      onError("Please choose a .md, .docx, or .html file.");
    }
    fileInput.value = "";
  });

  for (const eventName of ["dragenter", "dragover"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
  }

  for (const eventName of ["dragleave", "dragend"]) {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("drag-over");
    });
  }

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    const files = event.dataTransfer?.files;
    const file = files ? pickSupportedFile(files) : null;
    if (file) {
      void loadAndEmit(file, onLoad, onError);
    } else {
      onError("Please drop a .md, .docx, or .html file.");
    }
  });
}

async function loadAndEmit(
  file: File,
  onLoad: (file: LoadedFile) => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    let content: string;
    let format: LoadedFileFormat = "markdown";
    if (isDocxFile(file)) {
      content = await docxToMarkdown(await readFileAsArrayBuffer(file));
    } else if (isHtmlFile(file)) {
      // Deliberately NOT sanitized and NOT converted to Markdown - see this
      // file's module doc comment and PRODUCT-DECISIONS.md ADR-011. Safety
      // is enforced downstream by Pane rendering "html"-format content into
      // a sandboxed iframe (no allow-same-origin), never by innerHTML.
      content = await readFileAsText(file);
      format = "html";
    } else {
      content = await readFileAsText(file);
    }
    onLoad({ name: file.name, content, format });
  } catch (err) {
    onError(err instanceof Error ? err.message : "Failed to read file.");
  }
}
