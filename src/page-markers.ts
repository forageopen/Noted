/**
 * src/page-markers.ts
 *
 * Small dots overlaid on .content's scrollbar track (styles.css's
 * .page-markers/.page-marker-dot), one per A4-page-height's worth of
 * scrolled content - a rough on-screen reference for "about how many
 * printed pages is this," not a guaranteed match to actual PDF pagination
 * (which also depends on the print stylesheet's break-inside:avoid rules
 * pushing content to the next page early - see styles.css's @media print
 * block). Hovering a dot shows its page number via the native `title`
 * tooltip - no custom tooltip UI needed.
 */

/** A4 page height at 96 CSS px/inch (297mm / 25.4 * 96), the standard
 * "one printed page" reference used here. */
export const A4_PAGE_HEIGHT_PX = Math.round((297 / 25.4) * 96);

export interface PageMarker {
  /** 1-based - this marks the boundary at the end of page N. */
  page: number;
  /** Position along the track, in pixels from its top. */
  topPx: number;
}

/** Pure: given the content's total scrollable height and the track's own
 * height (both px), return one marker per full page-height boundary that
 * falls before the end of the content. Positions are computed
 * proportionally against `trackHeightPx` (a "minimap" style mapping - the
 * convention scroll-position minimaps commonly use), not against the
 * scrollbar thumb's actual travel range, since that's what reads correctly
 * to someone scanning the track for "roughly where is page N." */
export function computePageMarkers(
  scrollHeightPx: number,
  trackHeightPx: number,
  pageHeightPx: number = A4_PAGE_HEIGHT_PX,
): PageMarker[] {
  if (scrollHeightPx <= 0 || trackHeightPx <= 0 || pageHeightPx <= 0) return [];
  const markers: PageMarker[] = [];
  let boundary = pageHeightPx;
  let page = 1;
  while (boundary < scrollHeightPx) {
    markers.push({ page, topPx: (boundary / scrollHeightPx) * trackHeightPx });
    boundary += pageHeightPx;
    page++;
  }
  return markers;
}

/** DOM: (re)render `markers` into `overlay`. Clears and rebuilds -
 * simplest correct approach given this only re-runs on resize/content
 * change, not on every scroll tick. */
export function renderPageMarkers(overlay: HTMLElement, markers: PageMarker[]): void {
  overlay.replaceChildren();
  for (const marker of markers) {
    const dot = document.createElement("span");
    dot.className = "page-marker-dot";
    dot.style.top = `${marker.topPx}px`;
    dot.title = `Page ${marker.page}`;
    overlay.appendChild(dot);
  }
}

/** Wires a `.page-markers` overlay into `pane`, tracking `contentEl`'s
 * scrollHeight/size. Two observers, not one - a flex child's own rendered
 * size (ResizeObserver) doesn't change when its *content* overflows
 * (MutationObserver catches that - file loads, edits, and the Edit tab's
 * toolbar appearing/disappearing all end up firing one or the other).
 * Returns a stop function that disconnects both and removes the overlay -
 * callers (Pane.destroy) should call it to avoid leaking observers. */
export function setupPageMarkers(pane: HTMLElement, contentEl: HTMLElement): () => void {
  const overlay = document.createElement("div");
  overlay.className = "page-markers";
  pane.appendChild(overlay);

  const update = (): void => {
    const trackHeight = contentEl.clientHeight;
    overlay.style.top = `${contentEl.offsetTop}px`;
    overlay.style.height = `${trackHeight}px`;
    if (contentEl.hidden || trackHeight === 0) {
      overlay.replaceChildren();
      return;
    }
    renderPageMarkers(overlay, computePageMarkers(contentEl.scrollHeight, trackHeight));
  };

  update();

  // jsdom (this project's test environment) doesn't implement
  // ResizeObserver - guard rather than polyfill, since production
  // (Chromium, ADR-0003) always has it; tests still exercise the initial
  // `update()` call and MutationObserver path (jsdom does implement that).
  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
  resizeObserver?.observe(contentEl);
  const mutationObserver = new MutationObserver(update);
  mutationObserver.observe(contentEl, { childList: true, subtree: true, characterData: true });

  return () => {
    resizeObserver?.disconnect();
    mutationObserver.disconnect();
    overlay.remove();
  };
}
