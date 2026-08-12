/**
 * src/typing-effects.ts
 *
 * Composite typing experience, two modes so far:
 *
 * - "Echo" (on insert): the real glyph appears instantly (the browser's own
 *   insertion - untouched) and a warm duplicate of it expands and fades off,
 *   ~180ms - impact without the text becoming unreadable.
 * - "Sublime" (on delete): the character evaporates top-down - the upper
 *   half fades/blurs/lifts first while the lower half is still intact,
 *   with four small dust motes drifting up behind it. The longest and
 *   quietest of the set (~1s), deliberately with none of Echo's punch.
 *
 * Both are purely decorative and never block or delay the actual edit -
 * Sublime in particular must capture the about-to-be-deleted character's
 * position on `beforeinput` (before the browser removes it), then let the
 * real deletion proceed untouched.
 *
 * "Warp" (caret movement) is a planned third mode, not yet implemented.
 *
 * Respects prefers-reduced-motion (styles.css) by disabling the animations
 * entirely, same as confetti.ts.
 */

const ECHO_DURATION_MS = 180;
/** Safety margin over the CSS animation's own duration before the DOM node
 * is removed, so a dropped frame can't visibly clip the fade. */
const ECHO_CLEANUP_MS = ECHO_DURATION_MS + 60;

/** The bottom half's fade starts this many ms after the top half's, and
 * runs longer - see SUBLIME_TOP_DURATION_MS / SUBLIME_BOTTOM_DURATION_MS -
 * so the top visibly disappears well before the bottom does, rather than
 * both halves vanishing together. */
const SUBLIME_BOTTOM_DELAY_MS = 320;
const SUBLIME_TOP_DURATION_MS = 500;
const SUBLIME_BOTTOM_DURATION_MS = 650;
const SUBLIME_MOTE_DURATION_MS = 900;
const SUBLIME_MOTE_COUNT = 4;
/** Safety margin over the longest-running piece (the delayed bottom half). */
const SUBLIME_CLEANUP_MS = SUBLIME_BOTTOM_DELAY_MS + SUBLIME_BOTTOM_DURATION_MS + 80;

let sharedOverlay: HTMLElement | null = null;

/** One full-viewport, pointer-events:none overlay shared by every pane -
 * glyph rects come from getBoundingClientRect() (viewport-relative), so a
 * single overlay works regardless of which pane's contentEditable the
 * keystroke came from. Created lazily on first use, same pattern as
 * confetti.ts's per-trigger overlay. */
function getOverlay(): HTMLElement {
  if (sharedOverlay && document.body.contains(sharedOverlay)) return sharedOverlay;
  sharedOverlay = document.createElement("div");
  sharedOverlay.className = "typing-fx-overlay";
  document.body.appendChild(sharedOverlay);
  return sharedOverlay;
}

/** The theme's warm brand accent (--accent, styles.css) rather than the
 * real glyph's own text color - the real text color is dark-on-light in
 * Sakura, and a same-color duplicate/decay is nearly invisible there (no
 * contrast to read against). --accent is a warm pink/magenta in both
 * themes, so both effects read clearly regardless of which theme or text
 * color they're over. */
function readAccentColor(): string {
  return window.getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "currentColor";
}

export interface GlyphRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------
// Echo (insert)
// ---------------------------------------------------------------------

/** Pure: decides whether an `input` event represents a single typed
 * character worth echoing, and if so, which character. Deletions,
 * paragraph breaks, formatting commands, and multi-character insertions
 * (paste, autocomplete) all return null - Echo is "one extra additive quad
 * per key", not a general edit-highlight. */
export function insertedCharFromInputEvent(inputType: string, data: string | null): string | null {
  if (inputType !== "insertText" && inputType !== "insertCompositionText") return null;
  if (data === null || data.length !== 1) return null;
  return data;
}

/** DOM: the on-screen box of the character immediately before the
 * (collapsed) caret - i.e. the one just typed. Returns null for anything
 * the effect can't safely place (no selection, a non-collapsed selection,
 * caret not inside a text node, caret at a text node's very start, or a
 * zero-size rect e.g. an un-laid-out node) rather than throwing - Echo is
 * purely decorative and must never interfere with typing. */
export function caretCharacterRect(): GlyphRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const caret = selection.getRangeAt(0);
  const node = caret.endContainer;
  const offset = caret.endOffset;
  if (node.nodeType !== Node.TEXT_NODE || offset < 1) return null;

  const charRange = document.createRange();
  charRange.setStart(node, offset - 1);
  charRange.setEnd(node, offset);
  const rect = charRange.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** DOM: builds one echo glyph element, positioned exactly over the real
 * character and styled to match it (font + color) - styles.css's
 * `.echo-glyph` / `@keyframes echo-pulse` do the actual expand-and-fade. */
export function createEchoGlyphEl(char: string, rect: GlyphRect, font: string, color: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "echo-glyph";
  el.textContent = char;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.font = font;
  el.style.color = color;
  return el;
}

/** DOM: spawns one echo glyph into `overlay`, auto-removed once its
 * animation has finished. */
export function spawnEchoGlyph(overlay: HTMLElement, char: string, rect: GlyphRect, font: string, color: string): void {
  const el = createEchoGlyphEl(char, rect, font, color);
  overlay.appendChild(el);
  window.setTimeout(() => el.remove(), ECHO_CLEANUP_MS);
}

// ---------------------------------------------------------------------
// Sublime (delete)
// ---------------------------------------------------------------------

/** Pure: decides whether a `beforeinput` event is a single-character
 * delete Sublime should animate, and which direction. Word/line deletes,
 * cut, and anything else are left alone - same "one key" granularity as
 * Echo, not a general delete-highlight. */
export function deleteDirectionFromInputEvent(inputType: string): "backward" | "forward" | null {
  if (inputType === "deleteContentBackward") return "backward";
  if (inputType === "deleteContentForward") return "forward";
  return null;
}

export interface DeletionTarget {
  rect: GlyphRect;
  char: string;
}

/** DOM: the character about to be removed by a single-character delete,
 * and its on-screen box - captured from the *pre-deletion* DOM (call this
 * from a `beforeinput` handler, before the browser's default deletion
 * runs). "backward" is Backspace (the character before the caret);
 * "forward" is the Delete key (the character after the caret). Returns
 * null for anything unsafe to animate (no selection, non-collapsed
 * selection, caret not in a text node, caret at a text-node boundary with
 * nothing to take on that side, or a zero-size rect), mirroring
 * caretCharacterRect()'s guards - Sublime must never interfere with the
 * actual delete. */
export function caretDeletionTarget(direction: "backward" | "forward"): DeletionTarget | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const caret = selection.getRangeAt(0);
  const node = direction === "backward" ? caret.endContainer : caret.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const offset = direction === "backward" ? caret.endOffset : caret.startOffset;
  const text = node.textContent ?? "";
  const start = direction === "backward" ? offset - 1 : offset;
  const end = start + 1;
  if (start < 0 || end > text.length) return null;

  const charRange = document.createRange();
  charRange.setStart(node, start);
  charRange.setEnd(node, end);
  const rect = charRange.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    char: text.slice(start, end),
  };
}

/** DOM: one half (top or bottom) of the decaying glyph - an outer window
 * clipped to half the character's height (`overflow: hidden`) containing
 * an inner span sized to the *full* character height and font, shifted up
 * by half for the bottom half so only its lower portion shows through the
 * window. styles.css staggers the two halves' fade/blur/lift timing
 * (`.sublime-half-top` / `.sublime-half-bottom`) so the top visibly goes
 * first. */
export function createSublimeHalfEl(half: "top" | "bottom", char: string, rect: GlyphRect, font: string, color: string): HTMLElement {
  const halfHeight = rect.height / 2;
  const outer = document.createElement("span");
  outer.className = `sublime-half sublime-half-${half}`;
  outer.style.left = `${rect.left}px`;
  outer.style.width = `${rect.width}px`;
  outer.style.height = `${halfHeight}px`;
  outer.style.top = `${half === "top" ? rect.top : rect.top + halfHeight}px`;

  const inner = document.createElement("span");
  inner.className = "sublime-half-inner";
  inner.textContent = char;
  inner.style.width = `${rect.width}px`;
  inner.style.height = `${rect.height}px`;
  inner.style.font = font;
  inner.style.color = color;
  if (half === "bottom") inner.style.marginTop = `-${halfHeight}px`;

  outer.appendChild(inner);
  return outer;
}

export interface MoteSpec {
  /** Where along the glyph's width this mote starts, 0-100. */
  offsetXPercent: number;
  /** Small horizontal jitter over the animation. */
  driftXPx: number;
  /** How far up the mote drifts before fading out. */
  driftYPx: number;
  delayMs: number;
}

/** Pure: randomizes one dust mote's drift - "quiet" by design (a few px of
 * jitter, not confetti-scale movement). Takes a `random` function
 * (defaults to Math.random) so tests can supply a deterministic one. */
export function randomMoteSpec(random: () => number = Math.random): MoteSpec {
  return {
    offsetXPercent: 15 + random() * 70,
    driftXPx: (random() - 0.5) * 10,
    driftYPx: 14 + random() * 10,
    delayMs: random() * 150,
  };
}

/** DOM: builds one dust mote element near the top of the glyph's box. */
export function createMoteEl(rect: GlyphRect, spec: MoteSpec, color: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "sublime-mote";
  el.style.left = `${rect.left + (rect.width * spec.offsetXPercent) / 100}px`;
  el.style.top = `${rect.top}px`;
  el.style.background = color;
  el.style.animationDelay = `${spec.delayMs}ms`;
  el.style.setProperty("--mote-drift-x", `${spec.driftXPx}px`);
  el.style.setProperty("--mote-drift-y", `${-spec.driftYPx}px`);
  return el;
}

/** DOM: spawns one Sublime decay - the two glyph halves plus
 * SUBLIME_MOTE_COUNT dust motes - into `overlay`, wrapped in a single
 * container so they're all auto-removed together once the longest-running
 * piece has finished (same "one group, one cleanup" shape as confetti.ts's
 * launchConfettiBurst). Motes are appended before the glyph halves so they
 * paint behind it ("dust motes drift up behind it" - DOM order is paint
 * order within this shared stacking context). */
export function spawnSublimeDecay(
  overlay: HTMLElement,
  char: string,
  rect: GlyphRect,
  font: string,
  color: string,
  random: () => number = Math.random,
): void {
  const group = document.createElement("div");
  group.className = "sublime-decay";
  for (let i = 0; i < SUBLIME_MOTE_COUNT; i++) {
    group.appendChild(createMoteEl(rect, randomMoteSpec(random), color));
  }
  group.appendChild(createSublimeHalfEl("top", char, rect, font, color));
  group.appendChild(createSublimeHalfEl("bottom", char, rect, font, color));
  overlay.appendChild(group);
  window.setTimeout(() => group.remove(), Math.max(SUBLIME_CLEANUP_MS, SUBLIME_MOTE_DURATION_MS + 80));
}

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------

/** Wires Echo and Sublime onto one editable pane's content element.
 * Returns a stop function that removes both listeners (call from
 * Pane.destroy(), same shape as setupPageMarkers). Safe to call once per
 * pane; each pane gets its own listeners but they all share one overlay
 * (getOverlay()). */
export function setupTypingEffects(contentEl: HTMLElement): () => void {
  // Checks the attribute directly rather than isContentEditable - Pane
  // always sets contentEditable explicitly on this exact element (never
  // relies on ancestor inheritance - see setMode() in pane.ts), and
  // isContentEditable isn't implemented in the jsdom test environment.
  const isEditable = (): boolean => contentEl.contentEditable === "true";

  const styledFontFor = (node: Node | null): string => {
    const styledEl = node?.parentElement ?? contentEl;
    return window.getComputedStyle(styledEl).font;
  };

  const onInput = (event: Event): void => {
    if (!isEditable()) return;
    const inputEvent = event as InputEvent;
    const char = insertedCharFromInputEvent(inputEvent.inputType, inputEvent.data);
    if (char === null) return;

    const rect = caretCharacterRect();
    if (!rect) return;

    const caretNode = window.getSelection()?.getRangeAt(0).endContainer ?? null;
    spawnEchoGlyph(getOverlay(), char, rect, styledFontFor(caretNode), readAccentColor());
  };

  // Sublime must read the character's position BEFORE the browser deletes
  // it, so it hooks `beforeinput` (not `input`) and never calls
  // preventDefault() - the real deletion always proceeds untouched; this
  // only captures a snapshot to animate alongside it.
  const onBeforeInput = (event: Event): void => {
    if (!isEditable()) return;
    const inputEvent = event as InputEvent;
    const direction = deleteDirectionFromInputEvent(inputEvent.inputType);
    if (direction === null) return;

    const target = caretDeletionTarget(direction);
    if (!target) return;

    const caretNode = window.getSelection()?.getRangeAt(0).endContainer ?? null;
    spawnSublimeDecay(getOverlay(), target.char, target.rect, styledFontFor(caretNode), readAccentColor());
  };

  contentEl.addEventListener("input", onInput);
  contentEl.addEventListener("beforeinput", onBeforeInput);
  return () => {
    contentEl.removeEventListener("input", onInput);
    contentEl.removeEventListener("beforeinput", onBeforeInput);
  };
}
