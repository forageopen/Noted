/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderOfflineButton, isServiceWorkerSupported, type OfflineState } from "./offline";

describe("renderOfflineButton (pure DOM update)", () => {
  function button(): HTMLButtonElement {
    return document.createElement("button");
  }

  it("shows the download icon and is clickable for not-ready", () => {
    const btn = button();
    renderOfflineButton(btn, "not-ready");
    expect(btn.innerHTML).toContain("<svg");
    expect(btn.disabled).toBe(false);
    expect(btn.title.toLowerCase()).toContain("offline");
  });

  it("shows a distinct icon and is disabled once ready", () => {
    const notReady = button();
    renderOfflineButton(notReady, "not-ready");
    const ready = button();
    renderOfflineButton(ready, "ready");

    expect(ready.innerHTML).not.toBe(notReady.innerHTML);
    expect(ready.disabled).toBe(true);
    expect(ready.title.toLowerCase()).toContain("available offline");
  });

  it("disables the button and explains when unsupported", () => {
    const btn = button();
    renderOfflineButton(btn, "unsupported");
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-label")?.toLowerCase()).toContain("supported");
  });

  it("disables the button while checking, so a click can't double-fire", () => {
    const btn = button();
    renderOfflineButton(btn, "checking");
    expect(btn.disabled).toBe(true);
  });

  it("re-enables (clickable, to retry) on error", () => {
    const btn = button();
    renderOfflineButton(btn, "error");
    expect(btn.disabled).toBe(false);
  });

  it("every state produces a non-empty icon", () => {
    const states: OfflineState[] = ["unsupported", "not-ready", "checking", "ready", "error"];
    for (const state of states) {
      const btn = button();
      renderOfflineButton(btn, state);
      expect(btn.innerHTML).toContain("<svg");
    }
  });
});

describe("isServiceWorkerSupported", () => {
  it("reflects whether navigator.serviceWorker exists (jsdom doesn't implement it)", () => {
    expect(isServiceWorkerSupported()).toBe("serviceWorker" in navigator);
  });
});
