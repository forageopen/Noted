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
