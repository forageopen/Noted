/**
 * src/theme.ts
 *
 * Sakura/Cherry theme toggle, persisted in localStorage. Applied as
 * `data-theme="sakura" | "cherry"` on <html>, which styles.css keys off of
 * for both app chrome and rendered Markdown content.
 *
 * - Sakura: light pink surfaces, burgundy as the darkest/text color.
 * - Cherry: charcoal grey-black surfaces, neon pink accent, glowing button
 *   hover - see styles.css's `html[data-theme="cherry"]` block. (This used
 *   to be a three-way light/dark/sakura cycle; dark mode was retired and
 *   the other two renamed - old "light" -> "Sakura", old "sakura" ->
 *   "Cherry".)
 *
 * Pure logic (toggleTheme, resolveInitialTheme) is separated from DOM
 * wiring (applyTheme, setupThemeToggle) so the decision logic is
 * unit-testable without a full DOM.
 */

import { getString, setString } from "./storage";
import { blossomIcon, cherryIcon } from "./icons";

export type Theme = "sakura" | "cherry";

const THEME_ORDER: readonly Theme[] = ["sakura", "cherry"];

const THEME_KEY = "noted:theme";

/** Pure: flips sakura <-> cherry. */
export function toggleTheme(current: Theme): Theme {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  return next ?? "sakura";
}

/** Pure: given a stored value (possibly invalid/absent) and whether the OS
 * prefers dark mode, decide which theme to start with. Stored value wins. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "sakura" || stored === "cherry") return stored;
  return prefersDark ? "cherry" : "sakura";
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

const THEME_LABEL: Record<Theme, string> = {
  sakura: "Sakura",
  cherry: "Cherry",
};

// Icon for the theme a click switches TO - matches THEME_LABEL[next]
// exactly, so the icon and the tooltip/aria-label always name the same
// thing (showing the CURRENT theme's icon next to the NEXT theme's label
// was a bug fixed earlier - they visibly disagreed).
const NEXT_ICON: Record<Theme, string> = {
  sakura: cherryIcon,
  cherry: blossomIcon,
};

function renderLabel(button: HTMLButtonElement, theme: Theme): void {
  const next = toggleTheme(theme);
  button.innerHTML = NEXT_ICON[theme];
  button.title = THEME_LABEL[next];
  button.setAttribute("aria-label", `Switch theme - currently ${THEME_LABEL[theme]}, click for ${THEME_LABEL[next]}`);
  button.setAttribute("aria-pressed", String(theme === "cherry"));
}
