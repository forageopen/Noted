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
The user's own `.md` files, opened locally in the browser - nothing is uploaded anywhere.

##### Definition
A local-first, browser-native Markdown viewer and editor: drop a file in, read it, edit it, compare it against another, export it - without installing anything or sending the file anywhere.

**One-sentence pitch (direct request, verbatim intent):** "My very own browser-native Obsidian app."

## 2. Architecture

```
File (drag-and-drop or browse)
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
     Export (.html / .pdf / .docx)
```

Dual-pane mode runs two independent instances of this pipeline side by side, each with its own loaded file, viewer/editor state, and export controls - they don't share state with each other beyond both reading the same global theme.

## 3. Minimum Viable Delivery

> Model definition and filter: see `PRODUCT-PRINCIPLES.md` Section 2 (MVD).

**Scope decision (recorded, not a silent default):** ABIM's usual default is the smallest slice that proves one outcome, then re-induce. For Noted's first delivery, the owner explicitly chose the full v1 feature set below in one pass rather than a staged slice - see `PRODUCT-DECISIONS.md` Section 11, ADR-001. Re-induction (cutting scope if a piece proves not to matter) still applies after this first delivery, per ABIM Section 12.

### v1 feature set

- **Load a file**: drag-and-drop a `.md` file onto the page, or click to browse/select one from disk.
- **Viewer** (default mode): renders the loaded Markdown as formatted HTML.
- **Copy button**: copies the file's content to the clipboard.
- **Theme toggle**: switches the page (viewer chrome and rendered content) between light and dark.
- **Edit tab**: switches from Viewer to an editable view with basic formatting tools - highlighter plus the standard set (bold, italic, underline, strikethrough) - "the rest of basic stationery."
- **Export**: the currently loaded/edited content, to `.html`, `.pdf`, and `.docx`.
- **Dual window**: two independent load/view/edit panes side by side, for comparing two Markdown files at once.

### Explicitly out of scope for v1

- Multi-file vaults, folders, or a file tree (Obsidian-style vault browsing) - Noted v1 is single/dual-file, not a vault manager.
- Cloud sync, accounts, collaboration.
- A plugin system.
- Any AI-assisted writing/summarization feature.

These may become future proposals (see `PRODUCT-ROADMAP.md`) but are not assumed.

## 4. Criteria

*Based on the principle of Minimum Viable Delivery - directional checklist, not a 100%-mandatory compliance gate (same reasoning as human-kernel's `PRODUCT-DECISIONS.md`-referenced ADR-005 precedent).*

- Browser-native, runs entirely client-side.
- Local-first: a loaded file never leaves the user's machine.
- No account, no login.
- No cloud dependency.
- Zero install - open the URL, drop a file, done.
- Forkable and extensible - MIT licensed.
- No server (fully client-side).
- Offline-capable once loaded (no network calls after the page itself loads).
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
- **Markdown parsing** and **`.docx` export** require actual runtime libraries; a hand-rolled parser/serializer is not a reasonable use of effort per ABIM's Resource Arbitrage (`PRODUCT-PRINCIPLES.md` Section 7) when mature, small, well-tested options exist. Plain `tsc` (human-kernel's approach) can't resolve npm-package imports for the browser without a bundling step, so Noted introduces one - see `PRODUCT-DECISIONS.md` Section 11, ADR-002. The shipped output remains static files only; the bundler runs at build time, not runtime, so this does not compromise the "no server" / "zero install" criteria above.
- **PDF export**: the browser's own print pipeline (a print stylesheet + `window.print()` → "Save as PDF"), not a library - browsers already do this well, and it needs no dependency at all.
- **`.html` export**: the rendered content serialized into a minimal standalone HTML document (inlined styles), downloaded as a Blob - no dependency needed.

## 7. Repository Architecture

Same standard as `REPO-STANDARD.md` Section 1 (Repository Architecture) - applied with the Applicability rule: omit components not yet needed, no empty directories.
