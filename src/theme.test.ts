/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { toggleTheme, resolveInitialTheme, getStoredTheme, persistTheme, applyTheme } from "./theme";

describe("toggleTheme (pure)", () => {
  it("flips sakura <-> cherry", () => {
    expect(toggleTheme("sakura")).toBe("cherry");
    expect(toggleTheme("cherry")).toBe("sakura");
  });
});

describe("resolveInitialTheme (pure)", () => {
  it("prefers a valid stored value over OS preference", () => {
    expect(resolveInitialTheme("cherry", false)).toBe("cherry");
    expect(resolveInitialTheme("sakura", true)).toBe("sakura");
  });

  it("falls back to OS preference when nothing stored", () => {
    expect(resolveInitialTheme(null, true)).toBe("cherry");
    expect(resolveInitialTheme(null, false)).toBe("sakura");
  });

  it("falls back to OS preference when stored value is invalid", () => {
    expect(resolveInitialTheme("neon", true)).toBe("cherry");
  });

  it("rejects retired theme names (light/dark no longer exist)", () => {
    expect(resolveInitialTheme("light", false)).toBe("sakura");
    expect(resolveInitialTheme("dark", true)).toBe("cherry");
  });
});

describe("theme persistence (jsdom)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    expect(getStoredTheme()).toBeNull();
    persistTheme("cherry");
    expect(getStoredTheme()).toBe("cherry");
  });

  it("applyTheme sets data-theme on <html>", () => {
    applyTheme("cherry");
    expect(document.documentElement.getAttribute("data-theme")).toBe("cherry");
    applyTheme("sakura");
    expect(document.documentElement.getAttribute("data-theme")).toBe("sakura");
  });
});
