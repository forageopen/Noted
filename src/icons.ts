/**
 * src/icons.ts
 *
 * Icons for the header's icon-only buttons (theme cycle, dual-window
 * toggle, offline toggle) and the edit toolbar's highlighter toggle -
 * Lucide (https://lucide.dev, ISC license). No `lucide`/`lucide-static`
 * package dependency added - those ship ~1700 icons across multiple
 * formats (tens of MB) for the 7 this app actually uses, which doesn't fit
 * this app's "no unnecessary dependencies" posture (ADR-002) when the
 * alternative is embedding the handful of path/shape definitions we need
 * directly, sourced from Lucide's own icon-nodes.json. Same rendering
 * convention Lucide itself uses: 24x24 viewBox, stroke=currentColor
 * (so every icon automatically matches each button's text color, and
 * therefore each theme, with no extra CSS), no fill.
 */

const SIZE = 18;

type LucideNode = [tag: string, attrs: Record<string, string>];

function lucideIcon(nodes: LucideNode[]): string {
  const body = nodes
    .map(([tag, attrs]) => {
      const attrString = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag} ${attrString}/>`;
    })
    .join("");
  return `<svg viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Highlighter-toggle icon (edit toolbar's color popover trigger). Lucide "highlighter". */
export const highlighterIcon = lucideIcon([
  ["path", { d: "m9 11-6 6v3h9l3-3" }],
  ["path", { d: "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" }],
]);

/** Sakura theme's icon. Lucide "flower". */
export const blossomIcon = lucideIcon([
  ["circle", { cx: "12", cy: "12", r: "3" }],
  ["path", { d: "M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5" }],
  ["path", { d: "M12 7.5V9" }],
  ["path", { d: "M7.5 12H9" }],
  ["path", { d: "M16.5 12H15" }],
  ["path", { d: "M12 16.5V15" }],
  ["path", { d: "m8 8 1.88 1.88" }],
  ["path", { d: "M14.12 9.88 16 8" }],
  ["path", { d: "m8 16 1.88-1.88" }],
  ["path", { d: "M14.12 14.12 16 16" }],
]);

/** Cherry theme's icon. Lucide "cherry". */
export const cherryIcon = lucideIcon([
  ["path", { d: "M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z" }],
  ["path", { d: "M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z" }],
  ["path", { d: "M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12" }],
  ["path", { d: "M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z" }],
]);

/** Dual-window icon. Lucide "columns-2". */
export const dualPaneIcon = lucideIcon([
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["path", { d: "M12 3v18" }],
]);

/** Single-window icon. Lucide "square". */
export const singlePaneIcon = lucideIcon([["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]]);

/** Offline toggle, not-yet-enabled state. Lucide "cloud-download". */
export const cloudDownloadIcon = lucideIcon([
  ["path", { d: "M12 13v8l-4-4" }],
  ["path", { d: "m12 21 4-4" }],
  ["path", { d: "M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" }],
]);

/** Offline toggle, enabled state. Lucide "cloud-check". */
export const cloudCheckIcon = lucideIcon([
  ["path", { d: "m17 15-5.5 5.5L9 18" }],
  ["path", { d: "M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327" }],
]);
