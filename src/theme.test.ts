/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { resolveInitialTheme, getStoredTheme, persistTheme, applyTheme, setupThemeToggle, type Theme } from "./theme";

const ALL_THEMES: Theme[] = ["sakura", "cherry", "forest-brew", "tea-mist", "blueberry", "kokoblu", "dubai"];

describe("resolveInitialTheme (pure)", () => {
  it("prefers a valid stored value, whatever it is", () => {
    for (const theme of ALL_THEMES) {
      expect(resolveInitialTheme(theme)).toBe(theme);
    }
  });

  it("falls back to Cherry (the fixed default) when nothing is stored", () => {
    expect(resolveInitialTheme(null)).toBe("cherry");
  });

  it("falls back to Cherry when the stored value is invalid", () => {
    expect(resolveInitialTheme("neon")).toBe("cherry");
  });

  it("rejects retired theme names (light/dark no longer exist)", () => {
    expect(resolveInitialTheme("light")).toBe("cherry");
    expect(resolveInitialTheme("dark")).toBe("cherry");
  });
});

describe("theme persistence (jsdom)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    expect(getStoredTheme()).toBeNull();
    persistTheme("blueberry");
    expect(getStoredTheme()).toBe("blueberry");
  });

  it("applyTheme sets data-theme on <html>", () => {
    applyTheme("dubai");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dubai");
    applyTheme("sakura");
    expect(document.documentElement.getAttribute("data-theme")).toBe("sakura");
  });
});

describe("setupThemeToggle (DOM wiring)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = `<button id="theme-toggle"></button><div id="theme-popover" hidden></div>`;
  });

  function elements() {
    return {
      toggle: document.getElementById("theme-toggle") as HTMLButtonElement,
      popover: document.getElementById("theme-popover") as HTMLElement,
    };
  }

  it("applies Cherry by default (nothing stored) and returns it", () => {
    const { toggle, popover } = elements();
    const current = setupThemeToggle(toggle, popover);

    expect(current).toBe("cherry");
    expect(document.documentElement.getAttribute("data-theme")).toBe("cherry");
  });

  it("applies a previously-persisted theme instead of the default", () => {
    persistTheme("kokoblu");
    const { toggle, popover } = elements();
    const current = setupThemeToggle(toggle, popover);

    expect(current).toBe("kokoblu");
    expect(document.documentElement.getAttribute("data-theme")).toBe("kokoblu");
  });

  it("populates the popover with one option per theme, all seven", () => {
    const { toggle, popover } = elements();
    setupThemeToggle(toggle, popover);

    const options = Array.from(popover.querySelectorAll<HTMLButtonElement>(".theme-option"));
    expect(options).toHaveLength(7);
    expect(options.map((o) => o.dataset.theme).sort()).toEqual([...ALL_THEMES].sort());
  });

  it("marks only the active theme's option as checked", () => {
    const { toggle, popover } = elements();
    setupThemeToggle(toggle, popover); // defaults to cherry

    const checked = popover.querySelectorAll('.theme-option[aria-checked="true"]');
    expect(checked).toHaveLength(1);
    expect((checked[0] as HTMLElement).dataset.theme).toBe("cherry");
  });

  it("toggle opens/closes the popover and updates aria-expanded", () => {
    const { toggle, popover } = elements();
    setupThemeToggle(toggle, popover);
    expect(popover.hidden).toBe(true);

    toggle.click();
    expect(popover.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    expect(popover.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("picking a theme applies + persists it, closes the popover, and moves the checked mark", () => {
    const { toggle, popover } = elements();
    setupThemeToggle(toggle, popover);
    toggle.click();

    popover.querySelector<HTMLButtonElement>('.theme-option[data-theme="blueberry"]')!.click();

    expect(document.documentElement.getAttribute("data-theme")).toBe("blueberry");
    expect(getStoredTheme()).toBe("blueberry");
    expect(popover.hidden).toBe(true);
    expect(popover.querySelector('.theme-option[data-theme="blueberry"]')!.getAttribute("aria-checked")).toBe("true");
    expect(popover.querySelector('.theme-option[data-theme="cherry"]')!.getAttribute("aria-checked")).toBe("false");
  });

  it("calls onChange with the newly-picked theme", () => {
    const { toggle, popover } = elements();
    const picked: Theme[] = [];
    setupThemeToggle(toggle, popover, (theme) => picked.push(theme));
    toggle.click();

    popover.querySelector<HTMLButtonElement>('.theme-option[data-theme="tea-mist"]')!.click();

    expect(picked).toEqual(["tea-mist"]);
  });

  it("clicking outside the popover closes it", () => {
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const { toggle, popover } = elements();
    setupThemeToggle(toggle, popover);
    toggle.click();
    expect(popover.hidden).toBe(false);

    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(popover.hidden).toBe(true);
  });
});
