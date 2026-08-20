---
doc_id: PRODUCT-SPEC
authority: product-definition
retrieval_purpose: >
  What is being built: identity, architecture, feature set, criteria,
  platform constraints, proposed technology stack, repository architecture.
  Load for implementation, UI, or feature-scope questions.
consult_when: [implementation, architecture, feature-scope, ui]
skip_when: task does not touch product boundaries or technical shape
depends_on:
  - PRODUCT-PRINCIPLES.md   # ABIM / MVD model definitions referenced below
related:
  - PRODUCT-ROADMAP.md
  - PRODUCT-DECISIONS.md
authored: 2026-08-11
never_paraphrase: true
---

# PRODUCT-SPEC.md

## 1. Product Identity

**Noted™** [FOGA - Forage Global Architecture]

- Open source, MIT licensed.
- Open kernel: a minimal viewer/editor core with export as an attached capability, not a separate product.
- GitHub Pages is a **static hosting service** - Noted has no backend.

##### What this app does in one word
Workspace (a browser-native Markdown workspace).

###### Category
Static web app; everything runs in the user's browser, no backend server.

##### Source
The user's own `.md`, `.docx`, or `.html` files, opened locally in the browser - nothing is uploaded anywhere.

##### Definition
A local-first, browser-native Markdown viewer and editor: drop a file in, read it, edit it, compare it against another, export it - without installing anything or sending the file anywhere.

**One-sentence pitch (direct request, verbatim intent):** "My very own browser-native Obsidian app."

## 2. Architecture

```
File (drag-and-drop or browse: .md, .docx per ADR-003, or .html per ADR-010)
        |
        v
  .docx? -> mammoth (docx->HTML) -\
  .html? -> (already HTML)  ------+-> shared document IR -> Markdown text
        |
        v
   Markdown Parser
        |
        v
  ┌─────┴─────┐
  |           |
Viewer       Editor
  |           |
  └─────┬─────┘
        |
        v
  Export (.html / .pdf / .docx / .md / .json)
```

Dual-pane mode runs two independent instances of this pipeline side by side, each with its own loaded file, viewer/editor state, and export controls - they don't share state with each other beyond both reading the same global theme.

`.docx` and `.json` export, and `.docx`/`.html` upload, all consume/produce one shared document intermediate representation (headings/paragraphs/lists/tables/code blocks/inline formatting) rather than each format implementing its own independent parsing - see `PRODUCT-DECISIONS.md` Section 11, ADR-003 (`.docx`) and ADR-010 (`.html`).

## 3. Minimum Viable Delivery

> Model definition and filter: see `PRODUCT-PRINCIPLES.md` Section 2 (MVD).

**Scope decision (recorded, not a silent default):** ABIM's usual default is the smallest slice that proves one outcome, then re-induce. For Noted's first delivery, the owner explicitly chose the full v1 feature set below in one pass rather than a staged slice - see `PRODUCT-DECISIONS.md` Section 11, ADR-001. Re-induction (cutting scope if a piece proves not to matter) still applies after this first delivery, per ABIM Section 12.

### v1.0.0 feature set (delivered as one pass, per ADR-001)

- **Load a file**: drag-and-drop a `.md` file onto the page, or click to browse/select one from disk.
- **Viewer** (default mode): renders the loaded Markdown as formatted HTML.
- **Copy button**: copies the file's content to the clipboard.
- **Theme toggle**: Sakura (light pink/burgundy) / Cherry (charcoal/neon pink), a click-to-cycle button. A dark-mode third option was tried and retired early on; two themes covered it at this stage. *(Superseded in v1.2.0 - see below - once the theme set grew past two, a two-state cycle stopped being the right interaction shape.)*
- **Edit tab**: switches from Viewer to an editable view with formatting tools - an 18-color highlighter (with automatic text-contrast against dark highlight colors), bold/italic/underline/strikethrough, and a paragraph-style tool (H1/H2/H3/Body).
- **Export**: the currently loaded/edited content, to `.html`, `.pdf`, `.docx`, `.md`, and `.json` (the last two added after the initial pass - `.md` is a lossless re-download of the original source; `.json` is a lossless dump of the shared document IR, see Section 2).
- **Dual window**: two independent load/view/edit panes side by side, for comparing two Markdown files at once.
- **Offline mode**: opt-in (a button click, never automatic) - caches the app shell for use with no network connection, with self-updating cache-refresh logic so a returning visitor doesn't stay stuck on a stale cached version (see `PRODUCT-DECISIONS.md` Section 11, ADR-005).

### v1.1.0 additions (see `PRODUCT-DECISIONS.md` Section 11, ADR-003/ADR-004)

- **`.docx` upload**: opening a Word document works the same as opening a `.md` file - converted internally to Markdown text via the shared document IR, so every downstream feature (viewer, editor, every export format) treats it identically to a native Markdown file.
- **Visitor counter**: a real (non-simulated) "this week" / "total visitors" count in the footer, backed by a free third-party badge service (`visitor-badge.laobi.icu`) - the one deliberate, disclosed exception to the "no network calls after load" criterion in Section 4, recorded as ADR-004. *(Superseded in v1.2.0 - see below - this service counted every page load with no dedup at all, so a plain refresh inflated the number.)*
- **Auto-hide footer**: hidden by default (taskbar-style), reveals on hover, click-to-lock.

### v1.2.0 additions (see `PRODUCT-DECISIONS.md` Section 11, ADR-006/ADR-007)

- **Typing effects**: three purely decorative, `prefers-reduced-motion`-respecting modes layered onto ordinary editing, none of them altering the actual edit - "Echo" spawns a warm accent-colored duplicate of a just-typed glyph that expands and fades (~180ms); "Sublime" decays a just-deleted character top-down over ~1s, with four small dust motes; "Warp" is a persistent quad that tracks the caret between same-line positions, its two edges easing toward the new position on different time constants so it visibly stretches then re-forms.
- **Theme picker expanded to 7**: Sakura, Cherry, Forest Brew, Tea Mist, Blueberry, Kokoblu (no glow), Dubai (no glow) - replacing the v1.0.0 click-to-cycle toggle with a popover (`src/theme.ts`), since a blind cycle stopped being the right interaction once the set grew past two. Cherry became the default for a first-time visitor, replacing the prior OS-preference-based Sakura/Cherry split.
- **Visitor counter switched to GoatCounter**: real dedup by hashed IP+device+day server-side, fixing the v1.1.0 badge counter's "every refresh counts" problem. Footer now links to a public GoatCounter dashboard rather than showing inline badge images - an inline live number would have required embedding an API credential unsafely in client-side code, see ADR-006.

### v1.3.0 additions

- **Paragraph-selection delete**: deleting a selected range (not just a single character) now dissolves it word-by-word in reverse reading order (last word fades first, first word fades last) - the same "Sublime" look extended to word granularity, instead of nothing happening for anything past one character.
- **HTML sanitization** (security fix): see Section 6 below, ADR-008.
- Repository/CI/dependency hardening (least-privilege CI permissions, SHA-pinned GitHub Actions, ESLint, Dependabot, `SECURITY.md`) - not user-facing, recorded as ADR-009.

### v1.4.0 additions (see `PRODUCT-DECISIONS.md` Section 11, ADR-010)

- **`.html` upload**: opening an `.html` file works the same as opening a `.md` or `.docx` file - routed through the same shared document IR the `.docx` path uses (HTML -> `blocksFromElement` -> `blocksToMarkdown`), just without the mammoth conversion step, so every downstream feature treats it identically to a native Markdown file. No new parsing dependency needed.

### Explicitly out of scope for v1

- Multi-file vaults, folders, or a file tree (Obsidian-style vault browsing) - Noted v1 is single/dual-file, not a vault manager.
- Cloud sync, accounts, collaboration.
- A plugin system.
- Any AI-assisted writing/summarization feature.

These may become future proposals (see `PRODUCT-ROADMAP.md`) but are not assumed.

## 4. Criteria

*Based on the principle of Minimum Viable Delivery - directional checklist, not a 100%-mandatory compliance gate (same reasoning as human-kernel's `PRODUCT-DECISIONS.md`-referenced ADR-005 precedent). ~80% adherence is sufficient, matching that same precedent - the two items below annotated as disclosed exceptions are exactly the kind of gap this checklist is designed to tolerate rather than hide.*

- Browser-native, runs entirely client-side.
- Local-first: a loaded file never leaves the user's machine. *(True for every core feature, including `.docx` parsing, which runs entirely client-side on the user's own uploaded bytes - see the one disclosed exception, two bullets down.)*
- No account, no login.
- No cloud dependency (runtime). *(Same disclosed exception as below - a few build-time-only fetches, like the self-hosted font file and icon data, are not runtime cloud dependencies.)*
- Zero install - open the URL, drop a file, done.
- Forkable and extensible - MIT licensed.
- No server (fully client-side).
- Offline-capable once loaded, with one disclosed exception: the footer visitor counter (v1.1.0) makes a real network call on every page load - a third-party analytics script (GoatCounter, since ADR-006; originally a raw hit-badge, ADR-004), recorded in `PRODUCT-DECISIONS.md` Section 11. Every other feature, including full offline use of the viewer/editor/export pipeline, makes no network calls after the page loads.
- A single repository.
- One-click deployable with GitHub Pages.
- GitHub hosted; GitHub is a **distribution server**, not a runtime server.

## 5. Platform Constraints

Without any API or backend, Noted cannot:

- Persist a file anywhere but the browser it's open in (no server-side save).
- Sync across devices.
- Collaborate in real time between two people.
- Convert to formats requiring server-side rendering (anything beyond what a browser + client-side libraries can produce).

## 6. Proposed Architecture Summary

- JAMstack; platform: browser-based web app; hosting: GitHub Pages; backend: none; infrastructure: fully serverless.
- Language/runtime: TypeScript, vanilla DOM (no UI framework) - same convention as the `human-kernel` sibling repo.
- **Markdown parsing**, **`.docx` export**, and **`.docx` upload/parsing** require actual runtime libraries; a hand-rolled parser/serializer is not a reasonable use of effort per ABIM's Resource Arbitrage (`PRODUCT-PRINCIPLES.md` Section 7) when mature, small, well-tested options exist. Plain `tsc` (human-kernel's approach) can't resolve npm-package imports for the browser without a bundling step, so Noted introduces one - see `PRODUCT-DECISIONS.md` Section 11, ADR-002. The shipped output remains static files only; the bundler runs at build time, not runtime, so this does not compromise the "no server" / "zero install" criteria above. `.docx` upload's dependency (`mammoth`) is a real, disclosed cost against "Quick load"/"Lightweight" (grew the shipped bundle to ~1.7MB uncompressed / ~317KB gzipped) - accepted for the capability it buys, recorded as ADR-003.
- **Visitor counter** (v1.1.0, switched to GoatCounter in ADR-006): a tracking script injected only on the real production hostname (so local/dev/test page loads don't inflate the count), plus a static footer link to GoatCounter's public dashboard - not a library dependency, but a real, disclosed exception to the local-first/no-network-calls criteria above, recorded as ADR-004/ADR-006. Unlike the badge service it replaced, GoatCounter dedupes by hashed IP+device+day server-side rather than counting every page load.
- **PDF export**: the browser's own print pipeline (a print stylesheet + `window.print()` → "Save as PDF"), not a library - browsers already do this well, and it needs no dependency at all.
- **`.html` export**: the rendered content serialized into a minimal standalone HTML document (inlined styles), downloaded as a Blob - no dependency needed.
- **HTML sanitization**: every Markdown/`.docx`-derived HTML string is passed through `dompurify` (`src/sanitize.ts`) before it's allowed to touch `innerHTML` - `Markdown -> Parser -> Sanitizer -> Safe HTML -> DOM`. Not optional: `marked` (the Markdown parser) intentionally passes raw HTML embedded in the source straight through unchanged, so without this step a loaded file could execute arbitrary script in this app's origin. Recorded as ADR-008.

## 7. Repository Architecture

Same standard as `REPO-STANDARD.md` Section 1 (Repository Architecture) - applied with the Applicability rule: omit components not yet needed, no empty directories.
