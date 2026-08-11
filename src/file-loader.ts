/**
 * src/file-loader.ts
 *
 * Loading a .md file, either via drag-and-drop onto a drop zone or via a
 * hidden <input type=file> triggered by a visible "browse" button.
 *
 * Pure logic (isMarkdownFile, pickMarkdownFile) is kept separate from the
 * DOM wiring (setupFileLoader) so it's unit-testable without simulating
 * real drag events end to end.
 */

export interface LoadedFile {
  name: string;
  content: string;
}

/** Pure: does this File look like a Markdown file? */
export function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || file.type === "text/markdown";
}

/** Pure: pick the first Markdown file out of a FileList/array, or null. */
export function pickMarkdownFile(files: Iterable<File>): File | null {
  for (const file of files) {
    if (isMarkdownFile(file)) return file;
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
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
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
    const file = fileInput.files ? pickMarkdownFile(fileInput.files) : null;
    if (file) {
      void loadAndEmit(file, onLoad, onError);
    } else if (fileInput.files && fileInput.files.length > 0) {
      onError("Please choose a .md file.");
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
    const file = files ? pickMarkdownFile(files) : null;
    if (file) {
      void loadAndEmit(file, onLoad, onError);
    } else {
      onError("Please drop a .md file.");
    }
  });
}

async function loadAndEmit(
  file: File,
  onLoad: (file: LoadedFile) => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    const content = await readFileAsText(file);
    onLoad({ name: file.name, content });
  } catch (err) {
    onError(err instanceof Error ? err.message : "Failed to read file.");
  }
}
