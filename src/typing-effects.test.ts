/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertedCharFromInputEvent,
  caretCharacterRect,
  createEchoGlyphEl,
  spawnEchoGlyph,
  deleteDirectionFromInputEvent,
  caretDeletionTarget,
  createSublimeHalfEl,
  randomMoteSpec,
  createMoteEl,
  spawnSublimeDecay,
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

describe("deleteDirectionFromInputEvent (pure)", () => {
  it("recognizes backspace and the Delete key", () => {
    expect(deleteDirectionFromInputEvent("deleteContentBackward")).toBe("backward");
    expect(deleteDirectionFromInputEvent("deleteContentForward")).toBe("forward");
  });

  it("ignores word/line deletes and cut", () => {
    expect(deleteDirectionFromInputEvent("deleteWordBackward")).toBeNull();
    expect(deleteDirectionFromInputEvent("deleteSoftLineBackward")).toBeNull();
    expect(deleteDirectionFromInputEvent("deleteByCut")).toBeNull();
  });

  it("ignores non-delete edits", () => {
    expect(deleteDirectionFromInputEvent("insertText")).toBeNull();
  });
});

describe("caretDeletionTarget (DOM)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
    restoreRect();
  });

  it("returns null when there is no selection", () => {
    expect(caretDeletionTarget("backward")).toBeNull();
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

    expect(caretDeletionTarget("backward")).toBeNull();
  });

  it("backward: returns the character before the caret (Backspace target)", () => {
    const div = document.createElement("div");
    div.textContent = "ab";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 10, top: 20, width: 8, height: 16 });

    expect(caretDeletionTarget("backward")).toEqual({
      rect: { left: 10, top: 20, width: 8, height: 16 },
      char: "b",
    });
  });

  it("backward: returns null when the caret is at the very start (nothing before it)", () => {
    const div = document.createElement("div");
    div.textContent = "ab";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(caretDeletionTarget("backward")).toBeNull();
  });

  it("forward: returns the character after the caret (Delete key target)", () => {
    const div = document.createElement("div");
    div.textContent = "ab";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 20, width: 8, height: 16 });

    expect(caretDeletionTarget("forward")).toEqual({
      rect: { left: 0, top: 20, width: 8, height: 16 },
      char: "a",
    });
  });

  it("forward: returns null when the caret is at the very end (nothing after it)", () => {
    const div = document.createElement("div");
    div.textContent = "ab";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(caretDeletionTarget("forward")).toBeNull();
  });
});

describe("createSublimeHalfEl (DOM)", () => {
  const rect = { left: 10, top: 20, width: 8, height: 16 };

  it("positions the top half at the glyph's own top, clipped to half height", () => {
    const el = createSublimeHalfEl("top", "g", rect, "16px Consolas", "rgb(1, 2, 3)");
    expect(el.className).toBe("sublime-half sublime-half-top");
    expect(el.style.top).toBe("20px");
    expect(el.style.height).toBe("8px");
    const inner = el.querySelector(".sublime-half-inner") as HTMLElement;
    expect(inner.textContent).toBe("g");
    expect(inner.style.height).toBe("16px"); // full glyph height, not the clipped window
    expect(inner.style.marginTop).toBe("");
  });

  it("positions the bottom half lower by half the glyph height, and shifts its inner content up to reveal only the lower half", () => {
    const el = createSublimeHalfEl("bottom", "g", rect, "16px Consolas", "rgb(1, 2, 3)");
    expect(el.className).toBe("sublime-half sublime-half-bottom");
    expect(el.style.top).toBe("28px"); // rect.top + rect.height/2
    expect(el.style.height).toBe("8px");
    const inner = el.querySelector(".sublime-half-inner") as HTMLElement;
    expect(inner.style.marginTop).toBe("-8px");
  });
});

describe("randomMoteSpec (pure, with an injectable random source)", () => {
  it("is fully deterministic given a fixed random() function", () => {
    const fixed = () => 0.5;
    expect(randomMoteSpec(fixed)).toEqual(randomMoteSpec(fixed));
  });

  it("produces different motes for different random draws", () => {
    // randomMoteSpec consumes 4 random() calls per spec - a 2-value
    // alternating sequence would realign identically every 4 calls, so use
    // a simple incrementing sequence instead (mirrors confetti.test.ts's
    // intent: different draws -> different pieces).
    let call = 0;
    const sequence = () => (call++ * 0.13) % 1;
    expect(randomMoteSpec(sequence)).not.toEqual(randomMoteSpec(sequence));
  });

  it("keeps the drift small - quiet by design, not confetti-scale", () => {
    for (const seed of [0, 0.5, 0.999999]) {
      const spec = randomMoteSpec(() => seed);
      expect(Math.abs(spec.driftXPx)).toBeLessThanOrEqual(5);
      expect(spec.driftYPx).toBeGreaterThan(0);
      expect(spec.driftYPx).toBeLessThanOrEqual(24);
    }
  });
});

describe("createMoteEl (DOM)", () => {
  it("positions the mote within the glyph's box and sets its drift as CSS custom properties", () => {
    const rect = { left: 100, top: 50, width: 10, height: 16 };
    const spec = { offsetXPercent: 50, driftXPx: 3, driftYPx: 20, delayMs: 40 };
    const el = createMoteEl(rect, spec, "rgb(1, 2, 3)");
    expect(el.className).toBe("sublime-mote");
    expect(el.style.left).toBe("105px"); // left + width * 50%
    expect(el.style.top).toBe("50px");
    expect(el.style.background).toBe("rgb(1, 2, 3)");
    expect(el.style.animationDelay).toBe("40ms");
    expect(el.style.getPropertyValue("--mote-drift-x")).toBe("3px");
    expect(el.style.getPropertyValue("--mote-drift-y")).toBe("-20px");
  });
});

describe("spawnSublimeDecay (DOM)", () => {
  it("appends the two glyph halves and 4 dust motes, then removes them all together", () => {
    vi.useFakeTimers();
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);

    spawnSublimeDecay(overlay, "g", { left: 0, top: 0, width: 8, height: 16 }, "16px sans", "red");

    expect(overlay.querySelectorAll(".sublime-half")).toHaveLength(2);
    expect(overlay.querySelectorAll(".sublime-mote")).toHaveLength(4);

    vi.advanceTimersByTime(2000);
    expect(overlay.querySelectorAll(".sublime-half")).toHaveLength(0);
    expect(overlay.querySelectorAll(".sublime-mote")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("motes are appended before the glyph halves, so they paint behind it", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    spawnSublimeDecay(overlay, "g", { left: 0, top: 0, width: 8, height: 16 }, "16px sans", "red");

    const group = overlay.querySelector(".sublime-decay")!;
    const children = Array.from(group.children).map((c) => c.className);
    const lastMoteIndex = children.map((c) => c.includes("sublime-mote")).lastIndexOf(true);
    const firstHalfIndex = children.findIndex((c) => c.includes("sublime-half"));
    expect(lastMoteIndex).toBeLessThan(firstHalfIndex);
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

  it("stop() removes the input listener", () => {
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

  it("spawns a sublime decay for a single backspace, before the character is actually removed", () => {
    vi.useFakeTimers();
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);

    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 5, top: 5, width: 6, height: 12 });

    setupTypingEffects(contentEl);
    contentEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward" }));

    expect(document.querySelectorAll(".sublime-half")).toHaveLength(2);
    expect(document.querySelector(".sublime-half-inner")?.textContent).toBe("b");

    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
  });

  it("ignores beforeinput events that aren't a single-character delete", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);
    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 0, width: 6, height: 12 });

    setupTypingEffects(contentEl);
    contentEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteWordBackward" }));

    expect(document.querySelectorAll(".sublime-half")).toHaveLength(0);
  });

  it("ignores beforeinput on a non-editable pane (Viewer mode)", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "false";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);

    setupTypingEffects(contentEl);
    contentEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward" }));

    expect(document.querySelectorAll(".sublime-half")).toHaveLength(0);
  });

  it("stop() removes the beforeinput listener", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);
    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 0, width: 6, height: 12 });

    const stop = setupTypingEffects(contentEl);
    stop();
    contentEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward" }));

    expect(document.querySelectorAll(".sublime-half")).toHaveLength(0);
  });
});
