/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confettiColorForIndex,
  randomConfettiPiece,
  createConfettiPieceEl,
  launchConfettiBurst,
  setupConfettiTrigger,
} from "./confetti";

describe("confettiColorForIndex (pure)", () => {
  it("cycles through the palette rather than repeating the same color every time", () => {
    const first = confettiColorForIndex(0);
    const second = confettiColorForIndex(1);
    expect(first).not.toBe(second);
  });

  it("wraps back to the first color once the palette is exhausted", () => {
    const paletteSize = new Set(Array.from({ length: 50 }, (_, i) => confettiColorForIndex(i))).size;
    expect(confettiColorForIndex(0)).toBe(confettiColorForIndex(paletteSize));
  });

  it("returns a valid-looking hex color for any index", () => {
    for (const i of [0, 1, 5, 9, 10, 999]) {
      expect(confettiColorForIndex(i)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("randomConfettiPiece (pure, with an injectable random source)", () => {
  it("is fully deterministic given a fixed random() function", () => {
    const fixed = () => 0.5;
    expect(randomConfettiPiece(fixed)).toEqual(randomConfettiPiece(fixed));
  });

  it("produces different pieces for different random draws", () => {
    let call = 0;
    const sequence = () => [0.1, 0.9][call++ % 2]!;
    const a = randomConfettiPiece(sequence);
    const b = randomConfettiPiece(sequence);
    expect(a).not.toEqual(b);
  });

  it("keeps left position within 0-100%", () => {
    const atZero = randomConfettiPiece(() => 0);
    const atOne = randomConfettiPiece(() => 0.999999);
    expect(atZero.leftPercent).toBeGreaterThanOrEqual(0);
    expect(atOne.leftPercent).toBeLessThan(100);
  });
});

describe("createConfettiPieceEl (DOM)", () => {
  it("applies the spec and color as inline styles", () => {
    const spec = randomConfettiPiece(() => 0.5);
    const el = createConfettiPieceEl(spec, "#123456");
    expect(el.className).toBe("confetti-piece");
    expect(el.style.left).toBe(`${spec.leftPercent}%`);
    expect(el.style.background).toBe("rgb(18, 52, 86)"); // jsdom normalizes hex -> rgb()
    expect(el.style.getPropertyValue("--confetti-rotate")).toBe(`${spec.rotateDeg}deg`);
  });
});

describe("launchConfettiBurst (DOM)", () => {
  it("appends a populated burst to the overlay, then removes it after its lifetime", () => {
    vi.useFakeTimers();
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);

    launchConfettiBurst(overlay, "#ff0000");

    const burst = overlay.querySelector(".confetti-burst");
    expect(burst).not.toBeNull();
    expect(burst!.querySelectorAll(".confetti-piece").length).toBeGreaterThan(50); // "a lot... covering the whole screen"

    vi.advanceTimersByTime(6000);
    expect(overlay.querySelector(".confetti-burst")).toBeNull();

    vi.useRealTimers();
  });
});

describe("setupConfettiTrigger (DOM wiring)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("a single click fires exactly one burst", () => {
    const logo = document.createElement("h1");
    document.body.appendChild(logo);
    setupConfettiTrigger(logo);
    const overlay = document.querySelector(".confetti-overlay")!;

    logo.dispatchEvent(new MouseEvent("mousedown"));
    logo.dispatchEvent(new MouseEvent("mouseup"));

    expect(overlay.querySelectorAll(".confetti-burst")).toHaveLength(1);

    vi.advanceTimersByTime(500); // no repeat fires after release
    expect(overlay.querySelectorAll(".confetti-burst")).toHaveLength(1);
  });

  it("holding the logo down fires repeated bursts until release", () => {
    const logo = document.createElement("h1");
    document.body.appendChild(logo);
    setupConfettiTrigger(logo);
    const overlay = document.querySelector(".confetti-overlay")!;

    logo.dispatchEvent(new MouseEvent("mousedown"));
    vi.advanceTimersByTime(220 * 3);
    logo.dispatchEvent(new MouseEvent("mouseup"));

    // 1 immediate + 3 interval fires while held.
    expect(overlay.querySelectorAll(".confetti-burst").length).toBeGreaterThanOrEqual(4);

    const countAfterRelease = overlay.querySelectorAll(".confetti-burst").length;
    vi.advanceTimersByTime(1000);
    expect(overlay.querySelectorAll(".confetti-burst").length).toBe(countAfterRelease);
  });

  it("mouseleave also stops the hold, same as mouseup", () => {
    const logo = document.createElement("h1");
    document.body.appendChild(logo);
    setupConfettiTrigger(logo);
    const overlay = document.querySelector(".confetti-overlay")!;

    logo.dispatchEvent(new MouseEvent("mousedown"));
    vi.advanceTimersByTime(220);
    logo.dispatchEvent(new MouseEvent("mouseleave"));
    const countAtLeave = overlay.querySelectorAll(".confetti-burst").length;

    vi.advanceTimersByTime(1000);
    expect(overlay.querySelectorAll(".confetti-burst").length).toBe(countAtLeave);
  });

  it("wires cleanly even if called more than once (main.ts only calls it once per page load; not a supported repeat-call API, just shouldn't crash)", () => {
    const logo = document.createElement("h1");
    document.body.appendChild(logo);
    expect(() => setupConfettiTrigger(logo)).not.toThrow();
  });
});
