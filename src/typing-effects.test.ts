/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertedCharFromInputEvent,
  caretCharacterRect,
  createEchoGlyphEl,
  spawnEchoGlyph,
  setupTypingEffects,
} from "./typing-effects";

/** jsdom doesn't implement Range.getBoundingClientRect() at all (no layout
 * engine), so there's nothing for vi.spyOn to wrap - assign it directly.
 * `restoreRect()` (called from every describe block's afterEach) puts back
 * the original (missing) method regardless of whether a given test stubbed
 * it, so tests can't leak the stub into one another. */
const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;

function stubRect(rect: { left: number; top: number; width: number; height: number }): void {
  Range.prototype.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return this;
      },
    }) as DOMRect;
}

function restoreRect(): void {
  Range.prototype.getBoundingClientRect = originalGetBoundingClientRect;
}

describe("insertedCharFromInputEvent (pure)", () => {
  it("returns the typed character for a plain insertText event", () => {
    expect(insertedCharFromInputEvent("insertText", "a")).toBe("a");
  });

  it("returns the typed character for IME composition text", () => {
    expect(insertedCharFromInputEvent("insertCompositionText", "あ")).toBe("あ");
  });

  it("ignores deletions", () => {
    expect(insertedCharFromInputEvent("deleteContentBackward", null)).toBeNull();
  });

  it("ignores non-text edits (paragraph breaks, formatting commands)", () => {
    expect(insertedCharFromInputEvent("insertParagraph", null)).toBeNull();
    expect(insertedCharFromInputEvent("formatBold", null)).toBeNull();
  });

  it("ignores multi-character insertions (paste, autocomplete)", () => {
    expect(insertedCharFromInputEvent("insertText", "hello")).toBeNull();
    expect(insertedCharFromInputEvent("insertFromPaste", "hello")).toBeNull();
  });

  it("ignores a null data payload on insertText", () => {
    expect(insertedCharFromInputEvent("insertText", null)).toBeNull();
  });
});

describe("caretCharacterRect (DOM)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
    restoreRect();
  });

  it("returns null when there is no selection", () => {
    expect(caretCharacterRect()).toBeNull();
  });

  it("returns null when the caret sits at the very start of a text node", () => {
    const div = document.createElement("div");
    div.textContent = "a";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(caretCharacterRect()).toBeNull();
  });

  it("returns null for a non-collapsed selection", () => {
    const div = document.createElement("div");
    div.textContent = "ab";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.setEnd(div.firstChild!, 2);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(caretCharacterRect()).toBeNull();
  });

  it("returns the preceding character's box when the caret sits after real text", () => {
    const div = document.createElement("div");
    div.textContent = "ab";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 10, top: 20, width: 8, height: 16 });

    expect(caretCharacterRect()).toEqual({ left: 10, top: 20, width: 8, height: 16 });
  });
});

describe("createEchoGlyphEl (DOM)", () => {
  it("builds a positioned span carrying the character and matching style", () => {
    const el = createEchoGlyphEl("q", { left: 1, top: 2, width: 3, height: 4 }, "16px Consolas", "rgb(1, 2, 3)");
    expect(el.className).toBe("echo-glyph");
    expect(el.textContent).toBe("q");
    expect(el.style.left).toBe("1px");
    expect(el.style.top).toBe("2px");
    expect(el.style.width).toBe("3px");
    expect(el.style.height).toBe("4px");
    expect(el.style.color).toBe("rgb(1, 2, 3)");
  });
});

describe("spawnEchoGlyph (DOM)", () => {
  it("appends the glyph then removes it after its animation finishes", () => {
    vi.useFakeTimers();
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);

    spawnEchoGlyph(overlay, "z", { left: 0, top: 0, width: 1, height: 1 }, "16px sans", "red");
    expect(overlay.querySelectorAll(".echo-glyph")).toHaveLength(1);

    vi.advanceTimersByTime(500);
    expect(overlay.querySelectorAll(".echo-glyph")).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("setupTypingEffects (DOM wiring)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
    restoreRect();
  });

  it("spawns an echo glyph for a single typed character", () => {
    vi.useFakeTimers();
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "a";
    document.body.appendChild(contentEl);

    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 1);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 5, top: 5, width: 6, height: 12 });

    const stop = setupTypingEffects(contentEl);
    contentEl.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "a" }));

    expect(document.querySelectorAll(".echo-glyph")).toHaveLength(1);

    stop();
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
  });

  it("ignores input events on a non-editable pane (Viewer mode)", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "false";
    document.body.appendChild(contentEl);

    setupTypingEffects(contentEl);
    contentEl.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "a" }));

    expect(document.querySelectorAll(".echo-glyph")).toHaveLength(0);
  });

  it("ignores input events with no placeable caret rect", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    document.body.appendChild(contentEl);
    // No selection set up at all - caretCharacterRect() must return null.

    setupTypingEffects(contentEl);
    contentEl.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "a" }));

    expect(document.querySelectorAll(".echo-glyph")).toHaveLength(0);
  });

  it("stop() removes the listener", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "a";
    document.body.appendChild(contentEl);
    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 1);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 0, width: 1, height: 1 });

    const stop = setupTypingEffects(contentEl);
    stop();
    contentEl.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "a" }));

    expect(document.querySelectorAll(".echo-glyph")).toHaveLength(0);
  });
});
