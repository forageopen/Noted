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
  rangeWordTargets,
  createParagraphWordEl,
  spawnParagraphDissolve,
  currentCaretPoint,
  isSameLineMove,
  warpDecay,
  stepWarpEdges,
  warpConverged,
  createWarpQuadEl,
  setWarpQuadLine,
  updateWarpQuadRect,
  createWarpCaretController,
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
    });
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

describe("rangeWordTargets (DOM)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
    restoreRect();
  });

  it("returns null when there is no selection", () => {
    expect(rangeWordTargets()).toBeNull();
  });

  it("returns null for a collapsed selection - that's the single-character path instead", () => {
    const div = document.createElement("div");
    div.textContent = "hello";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 2);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(rangeWordTargets()).toBeNull();
  });

  it("returns null for a whitespace-only selection", () => {
    const div = document.createElement("div");
    div.textContent = "a   b";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 1);
    range.setEnd(div.firstChild!, 4);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(rangeWordTargets()).toBeNull();
  });

  it("splits a multi-word selection into one target per word, in reading order", () => {
    const div = document.createElement("div");
    div.textContent = "the quick brown fox";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.setEnd(div.firstChild!, "the quick brown fox".length);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 0, width: 10, height: 16 });

    const targets = rangeWordTargets();
    expect(targets?.map((t) => t.text)).toEqual(["the", "quick", "brown", "fox"]);
  });

  it("returns null for a selection spanning more than one text node", () => {
    const div = document.createElement("div");
    div.innerHTML = "hello <b>world</b>";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.setEnd(div.querySelector("b")!.firstChild!, 3);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(rangeWordTargets()).toBeNull();
  });
});

describe("createParagraphWordEl (DOM)", () => {
  it("builds a positioned span carrying the word and matching style, with the given delay", () => {
    const el = createParagraphWordEl({ text: "brown", rect: { left: 1, top: 2, width: 30, height: 16 } }, "16px Consolas", "rgb(1, 2, 3)", 110);
    expect(el.className).toBe("sublime-word");
    expect(el.textContent).toBe("brown");
    expect(el.style.left).toBe("1px");
    expect(el.style.top).toBe("2px");
    expect(el.style.width).toBe("30px");
    expect(el.style.color).toBe("rgb(1, 2, 3)");
    expect(el.style.animationDelay).toBe("110ms");
  });
});

describe("spawnParagraphDissolve (DOM)", () => {
  it("appends one word element per target, then removes them all together", () => {
    vi.useFakeTimers();
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const targets = [
      { text: "the", rect: { left: 0, top: 0, width: 20, height: 16 } },
      { text: "quick", rect: { left: 20, top: 0, width: 30, height: 16 } },
      { text: "fox", rect: { left: 50, top: 0, width: 20, height: 16 } },
    ];

    spawnParagraphDissolve(overlay, targets, "16px sans", "red");

    const words = overlay.querySelectorAll<HTMLElement>(".sublime-word");
    expect(words).toHaveLength(3);
    expect(Array.from(words).map((w) => w.textContent)).toEqual(["the", "quick", "fox"]);

    vi.advanceTimersByTime(2000);
    expect(overlay.querySelectorAll(".sublime-word")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("delays the LAST word the least (0ms) and the FIRST word the most - a reverse wave", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const targets = [
      { text: "the", rect: { left: 0, top: 0, width: 20, height: 16 } },
      { text: "quick", rect: { left: 20, top: 0, width: 30, height: 16 } },
      { text: "fox", rect: { left: 50, top: 0, width: 20, height: 16 } },
    ];

    spawnParagraphDissolve(overlay, targets, "16px sans", "red");

    const words = Array.from(overlay.querySelectorAll<HTMLElement>(".sublime-word"));
    const delays = words.map((w) => parseFloat(w.style.animationDelay));
    expect(delays[0]).toBeGreaterThan(delays[1]!); // "the" (first) delayed more than "quick"
    expect(delays[1]).toBeGreaterThan(delays[2]!); // "quick" delayed more than "fox" (last)
    expect(delays[2]).toBe(0); // "fox" (last word) starts immediately
  });
});

describe("currentCaretPoint (DOM)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
    restoreRect();
  });

  it("returns null when there is no selection", () => {
    expect(currentCaretPoint()).toBeNull();
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

    expect(currentCaretPoint()).toBeNull();
  });

  it("returns null for a degenerate zero-height rect", () => {
    const div = document.createElement("div");
    div.textContent = "a";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 5, top: 5, width: 0, height: 0 });

    expect(currentCaretPoint()).toBeNull();
  });

  it("returns the collapsed caret's point - zero width is expected, not an error", () => {
    const div = document.createElement("div");
    div.textContent = "a";
    document.body.appendChild(div);
    const range = document.createRange();
    range.setStart(div.firstChild!, 1);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 12, top: 8, width: 0, height: 18 });

    expect(currentCaretPoint()).toEqual({ x: 12, top: 8, height: 18 });
  });
});

describe("isSameLineMove (pure)", () => {
  it("is true for a horizontal move on the same line", () => {
    expect(isSameLineMove({ x: 10, top: 20, height: 16 }, { x: 30, top: 20, height: 16 })).toBe(true);
  });

  it("is false when the line changed (different top)", () => {
    expect(isSameLineMove({ x: 10, top: 20, height: 16 }, { x: 10, top: 50, height: 16 })).toBe(false);
  });

  it("is false when the line height changed (e.g. a different heading level)", () => {
    expect(isSameLineMove({ x: 10, top: 20, height: 16 }, { x: 30, top: 20, height: 26 })).toBe(false);
  });

  it("is false when x didn't actually change", () => {
    expect(isSameLineMove({ x: 10, top: 20, height: 16 }, { x: 10, top: 20, height: 16 })).toBe(false);
  });
});

describe("warpDecay (pure)", () => {
  it("moves current toward target, never past it, for a positive gap", () => {
    const next = warpDecay(0, 100, 16, 35);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
  });

  it("is a no-op once current already equals target", () => {
    expect(warpDecay(50, 50, 16, 35)).toBe(50);
  });

  it("a smaller time constant converges faster for the same dt", () => {
    const fast = warpDecay(0, 100, 16, 20);
    const slow = warpDecay(0, 100, 16, 200);
    expect(fast).toBeGreaterThan(slow);
  });

  it("more elapsed time closes more of the gap", () => {
    const soon = warpDecay(0, 100, 8, 50);
    const later = warpDecay(0, 100, 64, 50);
    expect(later).toBeGreaterThan(soon);
  });
});

describe("stepWarpEdges (pure)", () => {
  it("the leading edge (faster tau) closes more of the gap than the trailing edge in the same frame", () => {
    const edges = stepWarpEdges({ leadingX: 0, trailingX: 0 }, 100, 16);
    expect(edges.leadingX).toBeGreaterThan(edges.trailingX);
  });
});

describe("warpConverged (pure)", () => {
  it("is false while either edge is still meaningfully short of the target", () => {
    expect(warpConverged({ leadingX: 99, trailingX: 40 }, 100)).toBe(false);
  });

  it("is true once both edges are within epsilon of the target", () => {
    expect(warpConverged({ leadingX: 100, trailingX: 99.9 }, 100)).toBe(true);
  });
});

describe("createWarpQuadEl / setWarpQuadLine / updateWarpQuadRect (DOM)", () => {
  it("builds an unpositioned quad with the right class", () => {
    const el = createWarpQuadEl();
    expect(el.className).toBe("warp-quad");
  });

  it("setWarpQuadLine sets top/height only", () => {
    const el = createWarpQuadEl();
    setWarpQuadLine(el, 40, 18);
    expect(el.style.top).toBe("40px");
    expect(el.style.height).toBe("18px");
  });

  it("updateWarpQuadRect spans the two edges regardless of which is currently ahead", () => {
    const el = createWarpQuadEl();
    updateWarpQuadRect(el, { leadingX: 80, trailingX: 20 });
    expect(el.style.left).toBe("20px");
    expect(el.style.width).toBe("60px");
  });

  it("updateWarpQuadRect enforces a minimum width when the edges have nearly converged", () => {
    const el = createWarpQuadEl();
    updateWarpQuadRect(el, { leadingX: 50, trailingX: 50.1 });
    expect(el.style.width).toBe("2px"); // WARP_MIN_WIDTH_PX, not the raw 0.1px gap
  });
});

/** Manual fake scheduler for createWarpCaretController - captures the
 * queued callback instead of running on real frame timing, so tests can
 * advance the animation deterministically (same intent as vi.useFakeTimers
 * elsewhere in this file, but for requestAnimationFrame's callback-based
 * shape rather than setTimeout's). */
function makeFakeScheduler() {
  let queued: ((time: number) => void) | null = null;
  let time = 0;
  return {
    schedule: (cb: (time: number) => void): number => {
      queued = cb;
      return 1;
    },
    cancelSchedule: (): void => {
      queued = null;
    },
    hasQueued: (): boolean => queued !== null,
    /** Fires the queued frame (if any) `dtMs` after the last one. */
    tick(dtMs: number): void {
      time += dtMs;
      const cb = queued;
      queued = null;
      cb?.(time);
    },
  };
}

describe("createWarpCaretController (DOM + injectable scheduler)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("the first moveTo() (no previous position) snaps instantly - no animation, quad stays hidden", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const scheduler = makeFakeScheduler();
    const controller = createWarpCaretController(overlay, scheduler.schedule, scheduler.cancelSchedule);

    controller.moveTo({ x: 10, top: 20, height: 16 });

    expect(scheduler.hasQueued()).toBe(false);
    expect(overlay.querySelectorAll(".warp-quad")).toHaveLength(0);
  });

  it("a same-line move after an initial placement starts the animation, appends and shows the quad", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const scheduler = makeFakeScheduler();
    const controller = createWarpCaretController(overlay, scheduler.schedule, scheduler.cancelSchedule);

    controller.moveTo({ x: 10, top: 20, height: 16 });
    controller.moveTo({ x: 40, top: 20, height: 16 });

    expect(scheduler.hasQueued()).toBe(true);
    const quad = overlay.querySelector(".warp-quad") as HTMLElement;
    expect(quad).not.toBeNull();
    expect(quad.style.opacity).toBe("1");
  });

  it("ticking the animation converges and hides the quad again", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const scheduler = makeFakeScheduler();
    const controller = createWarpCaretController(overlay, scheduler.schedule, scheduler.cancelSchedule);

    controller.moveTo({ x: 10, top: 20, height: 16 });
    controller.moveTo({ x: 40, top: 20, height: 16 });

    for (let i = 0; i < 200 && scheduler.hasQueued(); i++) scheduler.tick(16);

    expect(scheduler.hasQueued()).toBe(false);
    const quad = overlay.querySelector(".warp-quad") as HTMLElement;
    expect(quad.style.opacity).toBe("0");
  });

  it("a move to a different line snaps instantly even mid-animation, cancelling it", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const scheduler = makeFakeScheduler();
    const controller = createWarpCaretController(overlay, scheduler.schedule, scheduler.cancelSchedule);

    controller.moveTo({ x: 10, top: 20, height: 16 });
    controller.moveTo({ x: 40, top: 20, height: 16 });
    expect(scheduler.hasQueued()).toBe(true);

    controller.moveTo({ x: 5, top: 60, height: 16 }); // different line

    expect(scheduler.hasQueued()).toBe(false);
    const quad = overlay.querySelector(".warp-quad") as HTMLElement;
    expect(quad.style.opacity).toBe("0");
  });

  it("stop() cancels any in-flight animation and removes the quad", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    const scheduler = makeFakeScheduler();
    const controller = createWarpCaretController(overlay, scheduler.schedule, scheduler.cancelSchedule);

    controller.moveTo({ x: 10, top: 20, height: 16 });
    controller.moveTo({ x: 40, top: 20, height: 16 });
    controller.stop();

    expect(scheduler.hasQueued()).toBe(false);
    expect(overlay.querySelectorAll(".warp-quad")).toHaveLength(0);
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

  it("spawns a reverse-wave paragraph dissolve when a multi-word selection is deleted", () => {
    vi.useFakeTimers();
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "the quick fox";
    document.body.appendChild(contentEl);

    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 0);
    range.setEnd(contentEl.firstChild!, "the quick fox".length);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 0, width: 20, height: 12 });

    setupTypingEffects(contentEl);
    // Same inputType a real Backspace-over-a-selection fires - the browser
    // doesn't use a different inputType for "selection" vs "single caret".
    contentEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward" }));

    const words = document.querySelectorAll<HTMLElement>(".sublime-word");
    expect(Array.from(words).map((w) => w.textContent)).toEqual(["the", "quick", "fox"]);
    expect(document.querySelectorAll(".sublime-half")).toHaveLength(0); // not the single-character path

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

  it("a same-line selectionchange while editing starts the warp quad", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);

    const setCaretAt = (offset: number): void => {
      const range = document.createRange();
      range.setStart(contentEl.firstChild!, offset);
      range.collapse(true);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
    };

    const stop = setupTypingEffects(contentEl);

    setCaretAt(0);
    stubRect({ left: 0, top: 20, width: 0, height: 16 });
    document.dispatchEvent(new Event("selectionchange")); // first placement - snaps, no quad appended yet

    setCaretAt(2);
    stubRect({ left: 20, top: 20, width: 0, height: 16 });
    document.dispatchEvent(new Event("selectionchange")); // same-line move - starts the animation

    const quad = document.querySelector(".warp-quad") as HTMLElement;
    expect(quad).not.toBeNull();
    expect(quad.style.opacity).toBe("1");

    stop();
  });

  it("ignores selectionchange while not editable (Viewer mode)", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "false";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);
    const range = document.createRange();
    range.setStart(contentEl.firstChild!, 1);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 20, width: 0, height: 16 });

    const stop = setupTypingEffects(contentEl);
    document.dispatchEvent(new Event("selectionchange"));

    expect(document.querySelectorAll(".warp-quad")).toHaveLength(0);
    stop();
  });

  it("ignores selectionchange for a selection outside this pane", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);

    const elsewhere = document.createElement("div");
    elsewhere.textContent = "outside";
    document.body.appendChild(elsewhere);
    const range = document.createRange();
    range.setStart(elsewhere.firstChild!, 1);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    stubRect({ left: 0, top: 20, width: 0, height: 16 });

    const stop = setupTypingEffects(contentEl);
    document.dispatchEvent(new Event("selectionchange"));

    expect(document.querySelectorAll(".warp-quad")).toHaveLength(0);
    stop();
  });

  it("stop() tears down the Warp controller (no dangling quad)", () => {
    const contentEl = document.createElement("div");
    contentEl.contentEditable = "true";
    contentEl.textContent = "ab";
    document.body.appendChild(contentEl);
    const setCaretAt = (offset: number): void => {
      const range = document.createRange();
      range.setStart(contentEl.firstChild!, offset);
      range.collapse(true);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
    };

    const stop = setupTypingEffects(contentEl);
    setCaretAt(0);
    stubRect({ left: 0, top: 20, width: 0, height: 16 });
    document.dispatchEvent(new Event("selectionchange"));
    setCaretAt(2);
    stubRect({ left: 20, top: 20, width: 0, height: 16 });
    document.dispatchEvent(new Event("selectionchange"));

    expect(document.querySelectorAll(".warp-quad")).toHaveLength(1);
    stop();
    expect(document.querySelectorAll(".warp-quad")).toHaveLength(0);
  });
});
