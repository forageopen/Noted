/**
 * src/theme.ts
 *
 * Light/dark theme toggle, persisted in localStorage. Applied as
 * `data-theme="light" | "dark"` on <html>, which styles.css keys off of
 * for both app chrome and rendered Markdown content.
 *
 * Pure logic (toggleTheme, resolveInitialTheme) is separated from DOM
 * wiring (applyTheme, setupThemeToggle) so the decision logic is
 * unit-testable without a full DOM.
 */

import { getString, setString } from "./storage";

export type Theme = "light" | "dark";

const THEME_KEY = "noted:theme";

/** Pure: flips the theme. */
export function toggleTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}

/** Pure: given a stored value (possibly invalid/absent) and whether the OS
 * prefers dark mode, decide which theme to start with. Stored value wins. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

/** DOM: read persisted theme (if any). */
export function getStoredTheme(): string | null {
  return getString(THEME_KEY, null);
}

/** DOM: persist the theme choice. */
export function persistTheme(theme: Theme): void {
  setString(THEME_KEY, theme);
}

/** DOM: apply the theme to the document root. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** DOM: figure out the theme to start with (stored, else OS preference). */
export function detectInitialTheme(): Theme {
  const stored = getStoredTheme();
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveInitialTheme(stored, prefersDark);
}

/**
 * Wire a toggle button: applies the initial theme immediately, updates the
 * button's label, and flips + persists on click.
 */
export function setupThemeToggle(button: HTMLButtonElement): Theme {
  let current = detectInitialTheme();
  applyTheme(current);
  renderLabel(button, current);

  button.addEventListener("click", () => {
    current = toggleTheme(current);
    applyTheme(current);
    persistTheme(current);
    renderLabel(button, current);
  });

  return current;
}

function renderLabel(button: HTMLButtonElement, theme: Theme): void {
  button.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  button.setAttribute("aria-pressed", String(theme === "dark"));
}
