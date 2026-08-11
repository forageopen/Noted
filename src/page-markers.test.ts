/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { computePageMarkers, renderPageMarkers, setupPageMarkers, A4_PAGE_HEIGHT_PX } from "./page-markers";

describe("computePageMarkers (pure)", () => {
  it("returns nothing when content is shorter than one page", () => {
    expect(computePageMarkers(500, 400, 1000)).toEqual([]);
  });

  it("returns one marker per full page boundary before the content ends", () => {
    // 3.5 pages of content -> boundaries at 1x and 2x page height (not 3x,
    // since content ends before a 4th page boundary would even start, and
    // not a marker for the partial 4th page since it never reaches a full
    // page-height boundary).
    const markers = computePageMarkers(3500, 1000, 1000);
    expect(markers.map((m) => m.page)).toEqual([1, 2, 3]);
  });

  it("positions markers proportionally against the track height", () => {
    // scrollHeight=2000, one page boundary at 1000 -> exactly halfway down
    // a 200px track.
    const markers = computePageMarkers(2000, 200, 1000);
    expect(markers).toEqual([{ page: 1, topPx: 100 }]);
  });

  it("defaults to a real A4 page height in px when not overridden", () => {
    expect(A4_PAGE_HEIGHT_PX).toBeGreaterThan(1100);
    expect(A4_PAGE_HEIGHT_PX).toBeLessThan(1150);
    const markers = computePageMarkers(A4_PAGE_HEIGHT_PX * 2.5, 1000);
    expect(markers).toHaveLength(2);
  });

  it("returns nothing for degenerate (zero/negative) inputs", () => {
    expect(computePageMarkers(0, 500, 1000)).toEqual([]);
    expect(computePageMarkers(5000, 0, 1000)).toEqual([]);
    expect(computePageMarkers(5000, 500, 0)).toEqual([]);
  });
});

describe("renderPageMarkers (DOM)", () => {
  it("renders one hoverable dot per marker, with the page number as its title", () => {
    const overlay = document.createElement("div");
    renderPageMarkers(overlay, [
      { page: 1, topPx: 50 },
      { page: 2, topPx: 150 },
    ]);
    const dots = overlay.querySelectorAll(".page-marker-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0]?.getAttribute("title")).toBe("Page 1");
    expect((dots[0] as HTMLElement).style.top).toBe("50px");
    expect(dots[1]?.getAttribute("title")).toBe("Page 2");
  });

  it("clears previous dots on re-render rather than accumulating", () => {
    const overlay = document.createElement("div");
    renderPageMarkers(overlay, [{ page: 1, topPx: 10 }]);
    renderPageMarkers(overlay, [{ page: 1, topPx: 10 }]);
    expect(overlay.querySelectorAll(".page-marker-dot")).toHaveLength(1);
  });
});

describe("setupPageMarkers (DOM wiring)", () => {
  it("creates a .page-markers overlay inside the pane and reflects content mutations", async () => {
    const pane = document.createElement("div");
    const content = document.createElement("div");
    pane.appendChild(content);
    document.body.appendChild(pane);

    // jsdom has no layout engine - clientHeight/scrollHeight are always 0,
    // so stub them to exercise the marker math the same way pane.test.ts
    // stubs getBoundingClientRect for the same reason.
    Object.defineProperty(content, "clientHeight", { value: 500, configurable: true });
    Object.defineProperty(content, "scrollHeight", { value: 500, configurable: true });

    const stop = setupPageMarkers(pane, content);
    const overlay = pane.querySelector(".page-markers");
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelectorAll(".page-marker-dot")).toHaveLength(0); // 500 < one page height

    Object.defineProperty(content, "scrollHeight", { value: A4_PAGE_HEIGHT_PX * 2, configurable: true });
    content.appendChild(document.createElement("p")); // triggers the MutationObserver

    await vi.waitFor(() => {
      expect(overlay!.querySelectorAll(".page-marker-dot").length).toBeGreaterThan(0);
    });

    stop();
    expect(pane.querySelector(".page-markers")).toBeNull();
  });
});
