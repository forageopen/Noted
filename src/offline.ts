/**
 * src/offline.ts
 *
 * "Make this site offline" button (src/sw.ts is the actual service worker
 * it registers). Opt-in, not automatic - registration only happens on
 * click, matching this app's "nothing happens without the visitor asking
 * for it" posture (no account, no cloud, no surprise background network
 * activity - PRODUCT-SPEC.md Section 4).
 *
 * DOM update (renderOfflineButton) is separated from the async
 * registration/detection calls so the icon/label/disabled logic is
 * unit-testable without mocking the whole Service Worker API.
 */

import { cloudDownloadIcon, cloudCheckIcon } from "./icons";

export type OfflineState = "unsupported" | "not-ready" | "checking" | "ready" | "error";

const LABELS: Record<OfflineState, string> = {
  unsupported: "Offline mode isn't supported in this browser",
  "not-ready": "Make this site available offline",
  checking: "Checking offline availability…",
  ready: "Available offline",
  error: "Couldn't enable offline mode - click to retry",
};

/** Pure: update the button's icon/title/aria-label/disabled for a state. */
export function renderOfflineButton(button: HTMLButtonElement, state: OfflineState): void {
  button.innerHTML = state === "ready" ? cloudCheckIcon : cloudDownloadIcon;
  button.title = LABELS[state];
  button.setAttribute("aria-label", LABELS[state]);
  button.disabled = state === "unsupported" || state === "ready" || state === "checking";
}

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** DOM: is there already an active registration covering this page? */
export async function checkOfflineReady(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return Boolean(registration?.active);
}

/** DOM: register src/sw.ts's compiled output and wait for it to activate.
 * Registered with a relative path/scope (not a hardcoded absolute one) so
 * this resolves correctly whether the app is served from the repo root, a
 * GitHub Pages project subpath, or localhost during development.
 *
 * The registration path is "sw.js" (site root), NOT "dist/sw.js" -
 * load-bearing, not stylistic. A service worker's script location caps the
 * max scope it can ever control to that script's own directory unless the
 * server sends a `Service-Worker-Allowed` header, which neither this app's
 * dev server nor GitHub Pages does. Registering "dist/sw.js" with scope
 * "./" (i.e. "/") was rejected outright by Chromium - confirmed via an
 * actual browser run, not just reasoning about it - so this app's offline
 * mode never actually activated in any real browser until this file and
 * package.json's build script (src/sw.ts now builds to /sw.js, a separate
 * esbuild invocation from src/main.ts's) were fixed together. */
export async function enableOffline(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;
  try {
    await navigator.serviceWorker.register("sw.js", { scope: "./", type: "module" });
    await navigator.serviceWorker.ready;
    return true;
  } catch (err) {
    // Swallowed into a generic "error" button state for the visitor, but
    // logged here rather than silently - a previous version's silent swallow
    // is exactly what let the scope bug above go unnoticed: the button just
    // said "error," with zero diagnostic trail toward why.
    console.error("Noted: failed to register the offline service worker.", err);
    return false;
  }
}

/** Wire the offline button: reflects whatever state already exists on
 * load (e.g. a returning visitor who enabled it last time), registers on
 * click if not already active. */
export function setupOfflineToggle(button: HTMLButtonElement): void {
  if (!isServiceWorkerSupported()) {
    renderOfflineButton(button, "unsupported");
    return;
  }

  renderOfflineButton(button, "checking");
  void checkOfflineReady().then((ready) => renderOfflineButton(button, ready ? "ready" : "not-ready"));

  button.addEventListener("click", () => {
    renderOfflineButton(button, "checking");
    void enableOffline().then((ok) => renderOfflineButton(button, ok ? "ready" : "error"));
  });
}
