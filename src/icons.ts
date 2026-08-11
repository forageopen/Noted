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

/** Highlighter-toggle icon (edit toolbar's color popover trigger) - a
 * marker/highlighter pen glyph. */
export const highlighterIcon = outlineIcon(
  '<path d="M9.5 19 3 20l1-6.5L14.5 3 21 9.5 9.5 19Z"/><path d="M13 5.5 18.5 11"/><path d="M3 20h5"/>',
);

/** Cherry theme's icon - two cherries (filled) on curved stems, matching
 * blossomIcon's filled-not-outline treatment (reads better solid at 18px
 * than as a thin outline). */
export const cherryIcon = `<svg viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="17" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="3" fill="currentColor" stroke="none"/><path d="M8 14C8 9 10 6 13 4M16 15c0-3 1-6 3-8"/></svg>`;
