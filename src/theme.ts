/**
 * src/theme.ts
 *
 * Seven-theme picker, persisted in localStorage. Applied as
 * `data-theme="sakura" | "cherry" | "forest-brew" | "tea-mist" | "blueberry" |
 * "kokoblu" | "dubai"` on <html>, which styles.css keys off of for both app
 * chrome and rendered Markdown content.
 *
 * - Sakura (light): pink surfaces, burgundy as the darkest/text color.
 * - Cherry (dark): charcoal grey-black surfaces, neon pink accent, glowing
 *   button hover. **The default for a first-time visitor** (no stored
 *   preference) - see resolveInitialTheme.
 * - Forest Brew (dark): deep forest green surfaces, olive-lime accent/text.
 * - Tea Mist (light): sage-green surfaces, dark forest-green accent/text.
 * - Blueberry (dark): blue-slate page background with a deliberately
 *   distinct deep-plum component surface, periwinkle-blue accent.
 * - Kokoblu (dark, no glow): dark brown surfaces, steel-blue accent/text.
 * - Dubai (dark, no glow): near-black brown surfaces, olive-lime accent/text.
 *
 * A single click-to-cycle toggle worked for two themes; it doesn't scale to
 * seven (a blind cycle through seven states is worse UX than picking by
 * name), so this is a popover picker instead - same open/close-on-
 * outside-click shape as Pane's export/highlight/paragraph-style popovers
 * (src/pane.ts's wirePopover), just for the one global (not per-pane)
 * picker rather than something instantiated per Pane.
 *
 * Pure logic (resolveInitialTheme) is separated from DOM wiring
 * (applyTheme, setupThemeToggle) so the decision logic is unit-testable
 * without a full DOM.
 */

import { getString, setString } from "./storage";
import { blossomIcon, cherryIcon, leafIcon, cloudFogIcon, grapeIcon, moonIcon, building2Icon, paletteIcon } from "./icons";

export type Theme = "sakura" | "cherry" | "forest-brew" | "tea-mist" | "blueberry" | "kokoblu" | "dubai";

const THEME_ORDER: readonly Theme[] = ["sakura", "cherry", "forest-brew", "tea-mist", "blueberry", "kokoblu", "dubai"];

const THEME_LABEL: Record<Theme, string> = {
  sakura: "Sakura",
  cherry: "Cherry",
  "forest-brew": "Forest Brew",
  "tea-mist": "Tea Mist",
  blueberry: "Blueberry",
  kokoblu: "Kokoblu",
  dubai: "Dubai",
};

const THEME_ICON: Record<Theme, string> = {
  sakura: blossomIcon,
  cherry: cherryIcon,
  "forest-brew": leafIcon,
  "tea-mist": cloudFogIcon,
  blueberry: grapeIcon,
  kokoblu: moonIcon,
  dubai: building2Icon,
};

const THEME_KEY = "noted:theme";

/** The theme a first-time visitor (nothing stored yet) starts on. */
const DEFAULT_THEME: Theme = "cherry";

function isTheme(value: string): value is Theme {
  return (THEME_ORDER as readonly string[]).includes(value);
}

/** Pure: given a stored value (possibly invalid/absent), decide which
 * theme to start with. A valid stored value always wins; otherwise every
 * visitor starts on DEFAULT_THEME (Cherry) - a fixed default, not an
 * OS-preference-based guess, so "first open" behavior is the same for
 * everyone regardless of their system's light/dark setting. */
export function resolveInitialTheme(stored: string | null): Theme {
  if (stored !== null && isTheme(stored)) return stored;
  return DEFAULT_THEME;
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

/** DOM: figure out the theme to start with (stored, else DEFAULT_THEME). */
export function detectInitialTheme(): Theme {
  return resolveInitialTheme(getStoredTheme());
}

/** DOM: (re)builds the popover's options, marking whichever matches
 * `current` as selected. Called on setup and again after every pick, since
 * the "currently selected" row's styling needs to move. */
function renderThemeOptions(popover: HTMLElement, current: Theme): void {
  popover.innerHTML = THEME_ORDER.map((theme) => {
    const selected = theme === current;
    return `<button type="button" class="theme-option" data-theme="${theme}" role="menuitemradio" aria-checked="${selected}">${THEME_ICON[theme]}<span>${THEME_LABEL[theme]}</span></button>`;
  }).join("");
}

/**
 * Wire the theme picker: applies the initial theme immediately, populates
 * the popover, and wires open/close + picking a theme. Returns the theme
 * applied at setup time. `onChange` (if given) fires with the new theme
 * whenever a visitor picks one from the popover - the pick happens on a
 * `.theme-option` inside the popover, not on `toggleButton` itself, so a
 * caller can no longer just attach its own click listener to the toggle
 * button the way the old two-state cycle allowed.
 */
export function setupThemeToggle(toggleButton: HTMLButtonElement, popover: HTMLElement, onChange?: (theme: Theme) => void): Theme {
  let current = detectInitialTheme();
  applyTheme(current);
  renderThemeOptions(popover, current);

  toggleButton.innerHTML = paletteIcon;
  toggleButton.title = "Theme";
  toggleButton.setAttribute("aria-haspopup", "true");

  const setOpen = (open: boolean): void => {
    popover.hidden = !open;
    toggleButton.setAttribute("aria-expanded", String(open));
  };
  setOpen(false);

  toggleButton.addEventListener("click", (event) => {
    event.stopPropagation(); // don't let this click immediately trigger the outside-click closer below
    toggleButton.setAttribute("aria-label", `Theme - currently ${THEME_LABEL[current]}`);
    setOpen(popover.hidden);
  });

  document.addEventListener("click", (event) => {
    if (popover.hidden) return;
    if (event.target === toggleButton || popover.contains(event.target as Node)) return;
    setOpen(false);
  });

  popover.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".theme-option");
    const theme = button?.dataset.theme;
    if (!theme || !isTheme(theme)) return;

    current = theme;
    applyTheme(current);
    persistTheme(current);
    renderThemeOptions(popover, current);
    toggleButton.setAttribute("aria-label", `Theme - currently ${THEME_LABEL[current]}`);
    setOpen(false);
    onChange?.(current);
  });

  toggleButton.setAttribute("aria-label", `Theme - currently ${THEME_LABEL[current]}`);

  return current;
}
