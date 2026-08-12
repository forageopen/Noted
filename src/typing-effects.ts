/**
 * src/typing-effects.ts
 *
 * "Echo" typing effect: on each character keystroke in an editable pane,
 * the real glyph appears instantly (the browser's own insertion - untouched)
 * and a warm duplicate of it expands and fades off, ~180ms - impact without
 * the text becoming unreadable. Purely decorative; never blocks or delays
 * the actual edit. First of a planned three-mode composite typing
 * experience (Echo on insert, "Sublime" decay on delete, "Warp" on caret
 * movement - later increments). Respects prefers-reduced-motion
 * (styles.css) by disabling the animation entirely, same as confetti.ts.
 */

const ECHO_DURATION_MS = 180;
/** Safety margin over the CSS animation's own duration before the DOM node
 * is removed, so a dropped frame can't visibly clip the fade. */
const ECHO_CLEANUP_MS = ECHO_DURATION_MS + 60;

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

export interface GlyphRect {
  left: number;
  top: number;
  width: number;
  height: number;
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

/** Wires the Echo effect onto one editable pane's content element. Returns
 * a stop function that removes the listener (call from Pane.destroy(), same
 * shape as setupPageMarkers). Safe to call once per pane; each pane gets
 * its own `input` listener but they all share one overlay (getOverlay()). */
export function setupTypingEffects(contentEl: HTMLElement): () => void {
  const handler = (event: Event): void => {
    // Checks the attribute directly rather than isContentEditable - Pane
    // always sets contentEditable explicitly on this exact element (never
    // relies on ancestor inheritance - see setMode() in pane.ts), and
    // isContentEditable isn't implemented in the jsdom test environment.
    if (contentEl.contentEditable !== "true") return;
    const inputEvent = event as InputEvent;
    const char = insertedCharFromInputEvent(inputEvent.inputType, inputEvent.data);
    if (char === null) return;

    const rect = caretCharacterRect();
    if (!rect) return;

    const caretNode = window.getSelection()?.getRangeAt(0).endContainer ?? null;
    const styledEl = caretNode?.parentElement ?? contentEl;
    const font = window.getComputedStyle(styledEl).font;
    // The "warm" duplicate uses the theme's brand accent (--accent), not the
    // real glyph's own text color - the real text color is dark-on-light in
    // Sakura, and a same-color duplicate is nearly invisible there (no
    // contrast to read as a second glyph). --accent is a warm pink/magenta
    // in both themes (styles.css), so the echo reads as a glow regardless
    // of which theme or text color it's over.
    const accent = window.getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "currentColor";
    spawnEchoGlyph(getOverlay(), char, rect, font, accent);
  };
  contentEl.addEventListener("input", handler);
  return () => contentEl.removeEventListener("input", handler);
}
