/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { toggleTheme, resolveInitialTheme, getStoredTheme, persistTheme, applyTheme } from "./theme";

describe("toggleTheme (pure)", () => {
  it("flips light to dark and back", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("light");
  });
});

describe("resolveInitialTheme (pure)", () => {
  it("prefers a valid stored value over OS preference", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("falls back to OS preference when nothing stored", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme(null, false)).toBe("light");
  });

  it("falls back to OS preference when stored value is invalid", () => {
    expect(resolveInitialTheme("neon", true)).toBe("dark");
  });
});

describe("theme persistence (jsdom)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    expect(getStoredTheme()).toBeNull();
    persistTheme("dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("applyTheme sets data-theme on <html>", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
