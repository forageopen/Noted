/**
 * src/export/html.ts
 *
 * .html export: wrap the currently-shown content HTML in a minimal
 * standalone document with inlined CSS, then trigger a download via a
 * Blob + temporary <a download> link. No dependency needed.
 */

import type { Theme } from "../theme";

/** Pure: build a standalone HTML document string. */
export function buildStandaloneHtml(title: string, bodyHtml: string, theme: Theme): string {
  const escapedTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle}</title>
<style>
${standaloneCss(theme)}
</style>
</head>
<body>
<article class="noted-content">
${bodyHtml}
</article>
</body>
</html>
`;
}

const STANDALONE_PALETTES: Record<Theme, { bg: string; fg: string; muted: string; border: string; codeBg: string; linkColor: string }> = {
  // Light pink + burgundy, matching styles.css's :root (Sakura's) block.
  sakura: { bg: "#fff0f5", fg: "#4a0e2e", muted: "#8a4a63", border: "#f3c6d6", codeBg: "#f8e1ea", linkColor: "#c2185b" },
  // Charcoal grey-black + neon pink, matching styles.css's html[data-theme="cherry"] block.
  cherry: { bg: "#141316", fg: "#ece7ea", muted: "#a99aa1", border: "#2c262a", codeBg: "#1c181c", linkColor: "#ff5ec2" },
  // Deep forest green + olive-lime, matching styles.css's html[data-theme="forest-brew"] block.
  "forest-brew": { bg: "#212e1e", fg: "#acc54e", muted: "#8fa968", border: "#3a4a34", codeBg: "#263424", linkColor: "#c3db6e" },
  // Sage green + dark forest-green accent, matching styles.css's html[data-theme="tea-mist"] block.
  "tea-mist": { bg: "#cad1ab", fg: "#242f21", muted: "#56604e", border: "#b9c293", codeBg: "#d2d8b7", linkColor: "#242f21" },
  // Blue-slate background + deep-plum surfaces + periwinkle accent, matching styles.css's html[data-theme="blueberry"] block.
  blueberry: { bg: "#4b4f76", fg: "#babcd3", muted: "#9799b5", border: "#5a5e82", codeBg: "#3e2038", linkColor: "#acbadb" },
  // Dark brown + steel-blue accent, matching styles.css's html[data-theme="kokoblu"] block.
  kokoblu: { bg: "#31221d", fg: "#a7bdd7", muted: "#8c97a3", border: "#4a3a34", codeBg: "#362621", linkColor: "#c3d3e6" },
  // Near-black brown + olive-lime accent, matching styles.css's html[data-theme="dubai"] block.
  dubai: { bg: "#2a1613", fg: "#abc44f", muted: "#8fa168", border: "#43302a", codeBg: "#301f1a", linkColor: "#c3d876" },
};

function standaloneCss(theme: Theme): string {
  const { bg, fg, muted, border, codeBg, linkColor } = STANDALONE_PALETTES[theme];
  return `
body { background: ${bg}; color: ${fg}; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; margin: 0; padding: 2rem; }
.noted-content { max-width: 46rem; margin: 0 auto; }
.noted-content h1, .noted-content h2, .noted-content h3 { line-height: 1.25; }
.noted-content a { color: ${linkColor}; }
.noted-content blockquote { border-left: 4px solid ${border}; margin: 1rem 0; padding: 0.25rem 1rem; color: ${muted}; }
.noted-content code { background: ${codeBg}; padding: 0.15em 0.35em; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.noted-content pre { background: ${codeBg}; padding: 1rem; overflow-x: auto; border-radius: 6px; }
.noted-content pre code { background: none; padding: 0; }
.noted-content table { border-collapse: collapse; width: 100%; }
.noted-content th, .noted-content td { border: 1px solid ${border}; padding: 0.4rem 0.6rem; }
.noted-content hr { border: none; border-top: 1px solid ${border}; }
`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** DOM: trigger a browser download of `content` as `filename`. */
export function downloadBlob(filename: string, content: BlobPart, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** DOM: build + download the standalone .html export. */
export function exportHtml(title: string, bodyHtml: string, theme: Theme): void {
  const html = buildStandaloneHtml(title, bodyHtml, theme);
  downloadBlob(withExtension(title, "html"), html, "text/html");
}

export function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "noted"}.${ext}`;
}
