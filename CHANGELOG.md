# Changelog

All notable changes to this repository are recorded here, per `REPO-STANDARD.md` Section 7.

## [Unreleased]

Nothing pending beyond v1.1.0.

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
