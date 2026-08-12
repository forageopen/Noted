# Changelog

All notable changes to this repository are recorded here, per `REPO-STANDARD.md` Section 7.

## [Unreleased]

### Added

- Sublime now animates deleting a whole selection, not just a single character: deleting a selected range dissolves it word-by-word in reverse reading order (last word fades first, first word fades last) - the same fade/blur/lift look as the single-character case, reused at word granularity, instead of nothing happening for anything past one character.

### Fixed

- `CACHE_NAME` bumped to `v12` alongside the above (`dist/main.js`/`styles.css` changed).

## [1.2.0] - 2026-08-12

### Added

- "Echo" typing effect: each keystroke in Edit mode spawns a warm accent-colored duplicate of the glyph that expands and fades over ~180ms. First of a three-mode composite typing experience (Echo on insert, Sublime decay on delete, Warp on caret movement). Respects `prefers-reduced-motion`.
- "Sublime" typing effect: each single-character delete (Backspace/Delete) decays the removed glyph top-down over ~1s - the upper half fades/blurs/lifts first while the lower half is still intact, with four small dust motes drifting up behind it. The real deletion is untouched and instant; this is a purely decorative overlay on top of it. Second of the three-mode composite typing experience. Respects `prefers-reduced-motion`.
- "Warp" typing effect: a persistent quad tracks the caret between same-line positions - its two edges each ease toward the new position on a different time constant, so the quad visibly stretches between the old and new spot before "re-forming" into a thin bar once the trailing edge catches up. Third and final mode of the composite typing experience. Respects `prefers-reduced-motion`.
- Five new themes: Forest Brew, Tea Mist, and Blueberry (owner-specified palettes, every other design token derived to match Sakura/Cherry's existing tint/shade relationships), then Kokoblu and Dubai (dark, explicitly no glow effect). Theme selection is now a popover picker (`src/theme.ts`), not a click-to-cycle toggle - doesn't scale past two or three states. See `PRODUCT-DECISIONS.md` ADR-007.

### Changed

- Visitor counter switched from `visitor-badge.laobi.icu` (counted every page load, including plain refreshes - no dedup at all) to GoatCounter, which dedupes by hashed IP+device+day server-side. The footer now links to a public GoatCounter dashboard instead of showing inline badge images - see `PRODUCT-DECISIONS.md` ADR-006 for why an inline live number isn't safe to fetch client-side.
- Default theme for a first-time visitor (nothing stored yet) is now always Cherry, regardless of OS light/dark preference - previously Sakura/Cherry split on `prefers-color-scheme`. See ADR-007.

### Fixed

- A returning visitor with offline mode previously enabled would keep being served a stale cached app shell indefinitely whenever `dist/main.js`/`styles.css` changed without `src/sw.ts` itself changing: a service worker only re-checks for an update when its own script's bytes differ, so nothing ever triggered a re-cache even though the deploy had landed. `CACHE_NAME` must be bumped alongside any such change - bumped to `v8` (Echo + Sublime), `v9` (Warp), `v10` (visitor counter switch), and `v11` (new themes).

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
