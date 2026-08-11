/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { setupFooterAutoHide } from "./footer";

function makeFooter(): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "app-footer";
  footer.innerHTML = '<a href="https://example.com">Credits</a> <span>text</span>';
  document.body.appendChild(footer);
  return footer;
}

describe("setupFooterAutoHide (DOM wiring)", () => {
  it("toggles footer-locked on when clicking the footer's own background", () => {
    const footer = makeFooter();
    setupFooterAutoHide(footer);

    footer.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(footer.classList.contains("footer-locked")).toBe(true);
  });

  it("toggles footer-locked back off on a second click", () => {
    const footer = makeFooter();
    setupFooterAutoHide(footer);

    const span = footer.querySelector("span")!;
    span.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    span.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(footer.classList.contains("footer-locked")).toBe(false);
  });

  it("does not toggle the lock when the click lands on a link inside the footer", () => {
    const footer = makeFooter();
    setupFooterAutoHide(footer);

    footer.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(footer.classList.contains("footer-locked")).toBe(false);
  });
});
