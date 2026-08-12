# Changelog

All notable changes to this repository are recorded here, per `REPO-STANDARD.md` Section 7.

## [Unreleased]

### Added

- "Echo" typing effect: each keystroke in Edit mode spawns a warm accent-colored duplicate of the glyph that expands and fades over ~180ms. First of a planned three-mode composite typing experience (Echo on insert; Sublime decay on delete and "Warp" caret-movement animation to follow). Respects `prefers-reduced-motion`.
- "Sublime" typing effect: each single-character delete (Backspace/Delete) decays the removed glyph top-down over ~1s - the upper half fades/blurs/lifts first while the lower half is still intact, with four small dust motes drifting up behind it. The real deletion is untouched and instant; this is a purely decorative overlay on top of it. Second of the three-mode composite typing experience (Warp caret-movement animation still to follow). Respects `prefers-reduced-motion`.

### Fixed

- A returning visitor with offline mode previously enabled would keep being served the pre-Echo/Sublime cached app shell indefinitely: `src/sw.ts`'s `CACHE_NAME` wasn't bumped when those two changes shipped, and a service worker only re-installs when its own script's bytes change - `sw.ts` itself was untouched, so nothing ever triggered a re-cache even though the deploy had landed. Bumped `CACHE_NAME` to `v8`.

## [1.1.0] - 2026-08-11

### Added

- `.docx` upload: opens like any other file, converted internally via the shared document IR (`mammoth` docx->HTML, then the existing HTML->IR path, then a new IR->Markdown serializer) - see `PRODUCT-DECISIONS.md` ADR-003.
- Footer visitor counter: real, non-simulated "this week" (resets every Monday) / "total visitors" count, backed by a free third-party badge service, guarded to only activate on the production hostname - see `PRODUCT-DECISIONS.md` ADR-004.
- Auto-hide footer: hidden by default (taskbar-style), reveals on hover, click to lock open.
- README hero image.

### Fixed

- Offline mode could leave a returning visitor permanently stuck on a stale cached app shell (e.g. an already-fixed favicon still showing broken) - added proactive update detection and a one-time reload when a newer service worker takes control. See `PRODUCT-DECISIONS.md` ADR-005.
- Favicon was invisible in all browsers due to an invalid XML comment (a literal `--` inside an SVG `<!-- -->` comment, which Chromium silently downgrades to text rendering instead of erroring).

## [1.0.0] - 2026-08-11

### Added

- Initial v1 application, delivered as one pass per `PRODUCT-DECISIONS.md` ADR-001: file load (drag-and-drop/browse), Markdown viewer, Edit tab (18-color highlighter with auto text-contrast, paragraph styles, bold/italic/underline/strikethrough), Sakura/Cherry theme toggle, export to `.html`/`.pdf`/`.docx`/`.md`/`.json`, dual-pane compare, offline mode (opt-in), confetti easter egg, self-hosted font (Erica One), Lucide-based icon set.
- `docs/product/` governing documents (`PRODUCT-SPEC.md`, `PRODUCT-PRINCIPLES.md`, `PRODUCT-ROADMAP.md`, `PRODUCT-DECISIONS.md`), `REPO-STANDARD.md`, `LICENSE` (MIT).

### Fixed

- Offline mode was completely non-functional in production: the service worker built to `dist/sw.js`, capping its controllable scope below the site root, which Chromium rejected outright. Fixed by building `sw.js` to the site root via a separate build step - see `PRODUCT-DECISIONS.md` ADR-002.
