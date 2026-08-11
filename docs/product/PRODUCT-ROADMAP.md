---
doc_id: PRODUCT-ROADMAP
authority: delivery-sequence
retrieval_purpose: >
  Phased delivery plan: architecture phase, v1 feature set (delivered as one
  pass per PRODUCT-DECISIONS.md ADR-001), and draft future phases. Load for
  sequencing or "what ships next" questions.
consult_when: [sequencing, phase-gating, version-scoping, "what ships next"]
skip_when: task is already scoped to a named phase
depends_on:
  - PRODUCT-SPEC.md
  - PRODUCT-PRINCIPLES.md
authored: 2026-08-11
never_paraphrase: true
---

# PRODUCT-ROADMAP.md

> **Governing method:** `PRODUCT-PRINCIPLES.md` (ABIM) is the core method. Phase 1+ below is a suggestive draft subject to re-induction, not a committed backlog - build only what validated evidence supports next.

## 1. Architecture Phase

GitHub Pages static app - browser-native, TypeScript, no backend. No further architecture phases are committed yet; a future desktop packaging (e.g. Tauri, matching the pattern `human-kernel` uses) or cloud-sync tier would be a proposal evaluated against validated demand, not a default next step.

## 2. Product Roadmap

### Phase 0: v1 (committed, delivered as one pass - PRODUCT-DECISIONS.md ADR-001)

- Drag-and-drop / browse-to-load a `.md` file
- Viewer (rendered Markdown)
- Copy button
- Light/dark theme toggle
- Edit tab (highlighter + bold/italic/underline/strikethrough)
- Export to `.html`, `.pdf`, `.docx`
- Dual-pane compare (two independent load/view/edit panes side by side)

### Phase 1: Draft, not committed

Candidates only - each needs its own outcome test (`PRODUCT-PRINCIPLES.md` Section 1.3) before being built:

- Recent-files list (session-only, no server storage) - reduces re-browsing friction.
- Find-in-document search within the viewer/editor.
- A synced-scroll option for dual-pane mode (scrolling one pane scrolls the other proportionally) - only if visitors actually use dual-pane for close comparison rather than side-by-side unrelated reading.
- Multiple simultaneous tabs/files beyond two (moves toward a "vault," which `PRODUCT-SPEC.md` Section 3 explicitly excludes from v1 - would need its own scope decision, not an incremental add).

### Phase 2: Draft, speculative

- Local folder access (File System Access API) for open-a-folder-of-notes browsing, if Phase 1's recent-files list proves people want persistence across sessions.
- Optional local-only autosave (browser storage, not cloud) of in-progress edits.

Nothing beyond Phase 0 is scheduled. Phase 1/2 exist so a future idea has somewhere to be recorded without being built prematurely.
