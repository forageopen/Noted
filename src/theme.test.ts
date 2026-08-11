/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { toggleTheme, resolveInitialTheme, getStoredTheme, persistTheme, applyTheme } from "./theme";

describe("toggleTheme (pure)", () => {
  it("cycles light -> dark -> sakura -> light", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("sakura");
    expect(toggleTheme("sakura")).toBe("light");
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

  it("accepts a stored sakura value", () => {
    expect(resolveInitialTheme("sakura", false)).toBe("sakura");
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
    applyTheme("sakura");
    expect(document.documentElement.getAttribute("data-theme")).toBe("sakura");
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
