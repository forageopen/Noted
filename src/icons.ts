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

/** Paragraph-style-toggle icon (edit toolbar's H1-H6/Body popover trigger). Lucide "heading". */
export const headingIcon = lucideIcon([
  ["path", { d: "M6 12h12" }],
  ["path", { d: "M6 20V4" }],
  ["path", { d: "M18 20V4" }],
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

/** Forest Brew theme's icon. Lucide "leaf". */
export const leafIcon = lucideIcon([
  ["path", { d: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" }],
  ["path", { d: "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" }],
]);

/** Tea Mist theme's icon. Lucide "cloud-fog". */
export const cloudFogIcon = lucideIcon([
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" }],
  ["path", { d: "M16 17H7" }],
  ["path", { d: "M17 21H9" }],
]);

/** Blueberry theme's icon. Lucide "grape". */
export const grapeIcon = lucideIcon([
  ["path", { d: "M22 5V2l-5.89 5.89" }],
  ["circle", { cx: "16.6", cy: "15.89", r: "3" }],
  ["circle", { cx: "8.11", cy: "7.4", r: "3" }],
  ["circle", { cx: "12.35", cy: "11.65", r: "3" }],
  ["circle", { cx: "13.91", cy: "5.85", r: "3" }],
  ["circle", { cx: "18.15", cy: "10.09", r: "3" }],
  ["circle", { cx: "6.56", cy: "13.2", r: "3" }],
  ["circle", { cx: "10.8", cy: "17.44", r: "3" }],
  ["circle", { cx: "5", cy: "19", r: "3" }],
]);

/** Kokoblu theme's icon. Lucide "moon". */
export const moonIcon = lucideIcon([
  [
    "path",
    {
      d: "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
    },
  ],
]);

/** Dubai theme's icon. Lucide "building-2". */
export const building2Icon = lucideIcon([
  ["path", { d: "M10 12h4" }],
  ["path", { d: "M10 8h4" }],
  ["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3" }],
  ["path", { d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" }],
  ["path", { d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" }],
]);

/** Theme-picker popover toggle icon. Lucide "palette". */
export const paletteIcon = lucideIcon([
  [
    "path",
    { d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" },
  ],
  ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor" }],
  ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor" }],
  ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor" }],
  ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor" }],
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
