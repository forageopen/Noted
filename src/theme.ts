/**
 * src/theme.ts
 *
 * Light/dark/sakura theme cycle, persisted in localStorage. Applied as
 * `data-theme="light" | "dark" | "sakura"` on <html>, which styles.css
 * keys off of for both app chrome and rendered Markdown content. Sakura is
 * dark-mode's charcoal grey-black surfaces with neon pink replacing the
 * blue accent (and a glowing hover effect on buttons) - see styles.css's
 * `html[data-theme="sakura"]` block.
 *
 * Pure logic (toggleTheme, resolveInitialTheme) is separated from DOM
 * wiring (applyTheme, setupThemeToggle) so the decision logic is
 * unit-testable without a full DOM.
 */

import { getString, setString } from "./storage";
import { sunIcon, moonIcon, blossomIcon } from "./icons";

export type Theme = "light" | "dark" | "sakura";

const THEME_ORDER: readonly Theme[] = ["light", "dark", "sakura"];

const THEME_KEY = "noted:theme";

/** Pure: cycles light -> dark -> sakura -> light. */
export function toggleTheme(current: Theme): Theme {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  return next ?? "light";
}

/** Pure: given a stored value (possibly invalid/absent) and whether the OS
 * prefers dark mode, decide which theme to start with. Stored value wins. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark" || stored === "sakura") return stored;
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

const NEXT_LABEL: Record<Theme, string> = {
  light: "Dark mode",
  dark: "Sakura mode",
  sakura: "Light mode",
};

// Icon for the mode a click switches TO - matches NEXT_LABEL exactly, so
// the icon and the tooltip/aria-label always name the same thing. (Showing
// the CURRENT theme's icon next to the NEXT theme's label was the bug -
// they visibly disagreed, e.g. the sun icon paired with a "Dark mode"
// tooltip while already in light mode.)
const NEXT_ICON: Record<Theme, string> = {
  light: moonIcon,
  dark: blossomIcon,
  sakura: sunIcon,
};

function renderLabel(button: HTMLButtonElement, theme: Theme): void {
  const next = NEXT_LABEL[theme];
  button.innerHTML = NEXT_ICON[theme];
  button.title = next;
  button.setAttribute("aria-label", `Switch theme - currently ${theme} mode, click for ${next.toLowerCase()}`);
  button.setAttribute("aria-pressed", String(theme !== "light"));
}
