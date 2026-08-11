/**
 * src/footer.ts
 *
 * Auto-hide footer, like a taskbar: hidden by default (styles.css's
 * .app-footer:hover reveals it, purely in CSS - no JS needed for that
 * part). This module only handles the "click to lock it open" half:
 * clicking the footer toggles a `.footer-locked` class, which the same
 * CSS rule also reveals on, so it stays open without the mouse hovering.
 * Clicking a second time removes the class and hands control straight back
 * to :hover - if the mouse isn't over it at that point, :hover simply
 * doesn't match and it auto-hides, with no extra logic needed here for
 * that half either.
 *
 * Clicks that land on one of the footer's own links (Adam Rosman/Forage/
 * Credits) are left alone - `closest("a")` bails out before toggling, so
 * following the link isn't muddled together with a lock/unlock side
 * effect.
 */
export function setupFooterAutoHide(footer: HTMLElement): void {
  footer.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) return;
    footer.classList.toggle("footer-locked");
  });
}
