/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { badgeUrl, isoWeekKey, setupVisitorCounter } from "./visitor-counter";

describe("isoWeekKey (pure)", () => {
  it("computes the ISO week for a plain midweek date", () => {
    // 2026-08-11 is a Tuesday in ISO week 33.
    expect(isoWeekKey(new Date("2026-08-11T00:00:00Z"))).toBe("2026-W33");
  });

  it("treats Monday as the start of the week (Sunday still belongs to the prior week's key)", () => {
    // 2026-08-10 is a Monday (start of week 33); 2026-08-09 is the Sunday
    // before it, still week 32.
    expect(isoWeekKey(new Date("2026-08-10T00:00:00Z"))).toBe("2026-W33");
    expect(isoWeekKey(new Date("2026-08-09T00:00:00Z"))).toBe("2026-W32");
  });

  it("handles a year boundary where the last days of December fall in week 1 of the next year", () => {
    // 2025-12-29 (Monday) is ISO week 1 of 2026, not week 53 of 2025.
    expect(isoWeekKey(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
  });

  it("handles a year boundary where the first days of January fall in the last week of the prior year", () => {
    // 2027-01-01 (Friday) is still ISO week 53 of 2026.
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });
});

describe("badgeUrl (pure)", () => {
  it("URL-encodes the page_id and left_text into a visitor-badge.laobi.icu query string", () => {
    const url = badgeUrl("some page id", "some title");
    expect(url.startsWith("https://visitor-badge.laobi.icu/badge?")).toBe(true);
    expect(url).toContain("page_id=some+page+id");
    expect(url).toContain("left_text=some+title");
  });
});

describe("setupVisitorCounter (DOM wiring)", () => {
  const PROD = "forageopen.github.io";

  it("points the week badge at a key containing this week's ISO week and the total badge at a fixed key", () => {
    const weekImg = document.createElement("img");
    const totalImg = document.createElement("img");
    setupVisitorCounter({ weekImg, totalImg }, new Date("2026-08-11T00:00:00Z"), PROD);

    expect(weekImg.src).toContain("2026-W33");
    expect(weekImg.src).toContain("visitor-badge.laobi.icu");
    expect(totalImg.src).toContain("visitor-badge.laobi.icu");
    expect(totalImg.src).not.toContain("W33");
  });

  it("gives the week and total badges different counter keys", () => {
    const weekImg = document.createElement("img");
    const totalImg = document.createElement("img");
    setupVisitorCounter({ weekImg, totalImg }, new Date("2026-08-11T00:00:00Z"), PROD);

    expect(weekImg.src).not.toBe(totalImg.src);
  });

  it("produces a stable total-badge URL regardless of the current date", () => {
    const a = { weekImg: document.createElement("img"), totalImg: document.createElement("img") };
    const b = { weekImg: document.createElement("img"), totalImg: document.createElement("img") };
    setupVisitorCounter(a, new Date("2026-01-01T00:00:00Z"), PROD);
    setupVisitorCounter(b, new Date("2026-12-31T00:00:00Z"), PROD);

    expect(a.totalImg.src).toBe(b.totalImg.src);
  });

  it("does not set either badge's src on a non-production hostname (e.g. localhost, dev/E2E testing)", () => {
    const weekImg = document.createElement("img");
    const totalImg = document.createElement("img");
    setupVisitorCounter({ weekImg, totalImg }, new Date("2026-08-11T00:00:00Z"), "localhost");

    expect(weekImg.getAttribute("src")).toBeNull();
    expect(totalImg.getAttribute("src")).toBeNull();
  });
});
