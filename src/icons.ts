/**
 * src/icons.ts
 *
 * Small hand-authored inline SVG icons for the header's icon-only buttons
 * (theme cycle, dual-window toggle, offline toggle) - no icon-library
 * dependency added; these are a handful of simple 18x18 outline/glyph
 * shapes using `currentColor`, so they automatically match each button's
 * text color (and therefore each theme, including Sakura's pink) with no
 * extra CSS.
 */

const SIZE = 18;

function outlineIcon(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const sunIcon = outlineIcon(
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
);

export const moonIcon = outlineIcon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');

/** Sakura theme's icon - a simplified 4-petal blossom (filled, not outline,
 * since a flower reads better solid than as a thin outline at 18px). */
export const blossomIcon = `<svg viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}" fill="currentColor" aria-hidden="true"><circle cx="12" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><circle cx="12" cy="12" r="2.5"/></svg>`;

export const dualPaneIcon = outlineIcon('<rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/>');

export const singlePaneIcon = outlineIcon('<rect x="4" y="4" width="16" height="16" rx="1"/>');

export const cloudDownloadIcon = outlineIcon(
  '<path d="M7 18a4 4 0 0 1-1-7.874A5 5 0 0 1 15.9 6.02 4.5 4.5 0 0 1 18 14.5H17"/><path d="M12 12v8M9 17l3 3 3-3"/>',
);

export const cloudCheckIcon = outlineIcon(
  '<path d="M7 18a4 4 0 0 1-1-7.874A5 5 0 0 1 15.9 6.02 4.5 4.5 0 0 1 18 14.5H17"/><path d="m9 15 2 2 4-4"/>',
);
