/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { setupVisitorTracking } from "./visitor-counter";

describe("setupVisitorTracking (DOM wiring)", () => {
  const PROD = "forageopen.github.io";

  it("injects GoatCounter's tracking script on the real production hostname", () => {
    const doc = document.implementation.createHTMLDocument();
    setupVisitorTracking(PROD, doc);

    const script = doc.head.querySelector<HTMLScriptElement>('script[src="//gc.zgo.at/count.js"]');
    expect(script).not.toBeNull();
    expect(script!.async).toBe(true);
    expect(script!.dataset.goatcounter).toBe("https://forage.goatcounter.com/count");
  });

  it("does not inject anything on a non-production hostname (e.g. localhost, dev/E2E testing)", () => {
    const doc = document.implementation.createHTMLDocument();
    setupVisitorTracking("localhost", doc);

    expect(doc.head.querySelector('script[src="//gc.zgo.at/count.js"]')).toBeNull();
  });

  it("is idempotent - calling it twice on production doesn't inject the script twice", () => {
    const doc = document.implementation.createHTMLDocument();
    setupVisitorTracking(PROD, doc);
    setupVisitorTracking(PROD, doc);

    expect(doc.head.querySelectorAll('script[src="//gc.zgo.at/count.js"]')).toHaveLength(1);
  });
});
