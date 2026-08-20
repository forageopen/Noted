/**
 * src/file-loader.ts
 *
 * Loading a .md, .docx, or .html file, either via drag-and-drop onto a drop
 * zone or via a hidden <input type=file> triggered by a visible "browse"
 * button. A .docx is converted to Markdown text on load (docx -> HTML via
 * mammoth -> shared IR via `blocksFromElement` -> Markdown via
 * `blocksToMarkdown`, see src/document-model.ts); a .html file goes through
 * the same shared IR minus the mammoth step (its markup is already HTML).
 * Every downstream consumer - the viewer, the Edit tab, .md/.html/.pdf/.json
 * export - only ever deals with Markdown text, regardless of which format
 * the file came in as.
 *
 * Pure logic (isSupportedFile, pickSupportedFile) is kept separate from the
 * DOM wiring (setupFileLoader) so it's unit-testable without simulating
 * real drag events end to end.
 */

import mammoth from "mammoth/mammoth.browser";
import { blocksFromElement, blocksToMarkdown } from "./document-model";
import { sanitizeHtml } from "./sanitize";

export interface LoadedFile {
  name: string;
  content: string;
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

/** Convert a raw .html file's text into Markdown, via the same shared IR
 * `docxToMarkdown` uses (HTML -> IR -> Markdown) - just without the mammoth
 * step, since the source is already HTML. A loaded .html file is exactly as
 * untrusted as mammoth's docx-derived HTML, so it goes through the same
 * `sanitizeHtml()` call before ever touching `innerHTML` (see sanitize.ts).
 * A full `<html><head>...<body>...</body></html>` document works fine here:
 * DOMPurify's default profile (no `WHOLE_DOCUMENT` option set) already
 * discards the doctype/head/script/style and keeps only body content. */
export function htmlToMarkdown(html: string): string {
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
    if (isDocxFile(file)) {
      content = await docxToMarkdown(await readFileAsArrayBuffer(file));
    } else if (isHtmlFile(file)) {
      content = htmlToMarkdown(await readFileAsText(file));
    } else {
      content = await readFileAsText(file);
    }
    onLoad({ name: file.name, content });
  } catch (err) {
    onError(err instanceof Error ? err.message : "Failed to read file.");
  }
}
