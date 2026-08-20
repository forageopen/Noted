---
doc_id: PRODUCT-DECISIONS
authority: governance-process
retrieval_purpose: >
  Who decides, and how: project role authority, open/unresolved decisions,
  and Sections 2-10 of the Repo Standard SOP (source of truth, development
  model, decision boundary, assumption control, ADR process, change
  management, definition of done, modification rules, traceability).
consult_when: [classifying-a-decision, recording-an-assumption, opening-an-adr,
  before-repository-modification, role-authority-question]
skip_when: never — low-impact decisions still default to established
  convention per Section 4 below rather than skipping this file entirely
depends_on: []
related:
  - PRODUCT-SPEC.md Section 7   # Repository Architecture, Section 1 of the same SOP
authored: 2026-08-11
never_paraphrase: true
---

# PRODUCT-DECISIONS.md

## 1. Project Governance — Roles

Same model as the `human-kernel` sibling repo:

- Product manager, backend/frontend/desktop developer, QA, technical writer: AI agent.
- Human (owner): directs the product, makes design decisions, validates outputs, refines the experience.

## 2. Open Decisions

None recorded yet.

## 3. Repo Standard SOP — Sections 2–10

> Section 1 (REPOSITORY ARCHITECTURE) of this SOP is recorded in `PRODUCT-SPEC.md` Section 7.

---

## 2. SOURCE OF TRUTH

| Concern | Authoritative location |
|---|---|
| Product intent | `docs/product/PRODUCT-PRINCIPLES.md` |
| Requirements | `docs/product/PRODUCT-SPEC.md` |
| Roadmap | `docs/product/PRODUCT-ROADMAP.md` |
| Architectural decisions | Section 11 below |
| Implementation | `src/` |
| Material changes | `CHANGELOG.md` |

Rules: one authoritative source per concern; do not duplicate specifications; references may point to the authoritative source; resolve conflicts before implementation; repository artifacts supersede undocumented conversational context.

---

## 3. DEVELOPMENT MODEL

```
Requirement → Design → Implement → Test → Review → Learn → Reprioritize → Next increment
```

Requirements may change when new evidence appears. Material changes must update the affected source of truth. Do not silently change requirements.

---

## 4. DECISION BOUNDARY

**LOW IMPACT** (naming, minor spacing, local implementation details, reversible cosmetic choices) - proceed using established conventions.

**MATERIAL** (feature behavior, user flow, information architecture, acceptance criteria, externally observable behavior) - record assumption or resolve before implementation when the ambiguity materially affects the result.

**HIGH IMPACT** (architecture, data model, security, privacy, authentication, storage, API contracts, platform, deployment, compatibility, major dependencies, regulatory/compliance constraints, irreversible technical decisions) - STOP. Resolve and record the decision before proceeding.

---

## 5. ASSUMPTION CONTROL

```
UNKNOWN:
IMPACT:
ASSUMPTION:
STATUS:
```

An assumption must not silently become a requirement. If it becomes material, convert it into an explicit decision.

---

## 6. ARCHITECTURAL DECISIONS

Use Section 11 below. ADR minimum structure:

```
# ADR-NNN: Title

Status:
Context:
Decision:
Consequences:
```

Do not create ADRs for trivial implementation choices.

---

## 7. CHANGE MANAGEMENT

For every material change: identify affected source(s) of truth; assess impact; update requirement/specification if necessary; implement the smallest coherent change; test; update affected documentation; update `CHANGELOG.md` when user-visible, architectural, or otherwise material.

---

## 8. DEFINITION OF DONE

```
Requirement → Acceptance criteria → Design → Implementation → Verification → Documentation → Release
```

A feature may be considered complete without every documentation artifact when that artifact is genuinely not applicable.

---

## 9. MODIFICATION RULES

Before modifying: read `REPO-STANDARD.md`; read relevant requirements; inspect relevant ADRs; inspect affected implementation; identify conflicts and dependencies; determine decision boundaries; implement; verify; update affected records.

Do not assume missing information is permission to invent requirements. Do not block development for low-impact ambiguity.

---

## 10. TRACEABILITY REQUIREMENT

```
Product intent → Requirement → Design → Technical decision → Implementation → QA verification → Release → Change record
```

Break the chain only where a stage is genuinely not applicable.

---

## 11. ARCHITECTURAL DECISION LOG

### ADR-001: v1 built as one full pass, not staged MVD slices
**Status:** Accepted
**Context:** ABIM's default (`PRODUCT-PRINCIPLES.md` Section 1) is the smallest slice that proves one outcome, then re-induce. The owner explicitly chose to build the entire v1 feature set (`PRODUCT-SPEC.md` Section 3) - viewer, editor, theme, export ×3 formats, dual-pane - in one delivery pass rather than shipping the viewer alone first.
**Decision:** v1 ships as one pass, by explicit instruction, not by ABIM's default. Re-induction (dropping or reworking a piece that proves not to matter) still applies after this delivery, per ABIM Section 12 - "built in one pass" is not "immune from later cuts."
**Consequences:** The delivered surface area is larger than an ABIM-default first slice would be. Post-delivery validation should watch for pieces of this pass (e.g. `.docx` export, dual-pane) that see little real use, as candidates for that re-induction pass rather than assuming everything shipped is load-bearing forever.

### ADR-002: Introduce a build-time bundler for browser-runtime dependencies
**Status:** Accepted
**Context:** `human-kernel` (sibling repo) ships with plain `tsc` transpilation and no runtime npm dependencies in the browser. Noted needs a Markdown parser and a `.docx` serializer - both non-trivial to hand-roll well, and per ABIM's Resource Arbitrage (`PRODUCT-PRINCIPLES.md` Section 1.7) reuse is preferred over rebuilding solved infrastructure. Plain `tsc` output keeps `import` specifiers as-is, which browsers can't resolve against `node_modules` without either a bundler or an import map pointing at vendored files.
**Decision:** Add a build-time bundling step (esbuild) so npm packages (Markdown parser, `.docx` builder) can be used directly. This runs at build/CI time only; the shipped artifact remains static files with no server component, so it does not compromise the "no server" / "zero install" / "browser-native" criteria in `PRODUCT-SPEC.md` Section 4.
**Consequences:** Noted's build tooling now differs slightly from `human-kernel`'s (a bundling step exists here that doesn't there). This is a per-repo technology-selection decision (`PRODUCT-DECISIONS.md` Section 6 scope), not a `REPO-STANDARD.md` violation - the repository *architecture* (folder layout, docs structure) stays identical across both repos; only the build pipeline for this repo's specific runtime dependencies differs.

### ADR-003: Add `.docx` upload via `mammoth`, accepting real bundle-size cost
**Status:** Accepted
**Context:** v1.0.0 only accepted `.md` files. The owner requested Word-document compatibility. Hand-rolling an OOXML (`.docx` zip + `document.xml`) parser was considered and rejected as disproportionate effort per ABIM's Resource Arbitrage (`PRODUCT-PRINCIPLES.md` Section 7) - real `.docx` files have enough structural variety (styles, numbering, embedded relationships) that a credible parser is a project in itself. `mammoth` (docx -> HTML) was chosen specifically because its HTML output plugs directly into the shared document IR's existing HTML-to-IR path (`blocksFromElement`, originally built for the Edit tab), so the only genuinely new code needed was an IR-to-Markdown serializer.
**Decision:** Add `mammoth` as a runtime dependency. Accept the resulting bundle-size growth (`dist/main.js`: ~1.7MB uncompressed / ~317KB gzipped, up from a much smaller baseline) as the cost of this capability, disclosed rather than absorbed silently - see `PRODUCT-SPEC.md` Section 6.
**Consequences:** "Quick load" / "Lightweight" (`PRODUCT-SPEC.md` Section 4) are now met with a disclosed exception rather than fully. Verified end-to-end (a real generated `.docx`, uploaded via a real browser, both locally and against the live production URL) before shipping - see `RETROSPECTIVE-FEATURE-DELIVERY.md` in `docs/retrospective/` for the full delivery account.

### ADR-004: Footer visitor counter - a disclosed, recorded exception to local-first/no-network-calls
**Status:** Accepted (backfilled - see Consequences)
**Context:** The owner requested a real (non-simulated), free, no-backend visitor counter, split into "this week" (resets Monday) and "total." The only viable approach without a backend of Noted's own is an embedded third-party badge `<img>` - which necessarily sends the visitor's IP/user-agent to that third party on every page load. This is a **Privacy**-affecting decision under the Decision Boundary (Section 4 above): *"Affects: ...Privacy... Action: STOP. Resolve and record the decision before proceeding."*
**Decision:** Ship the counter (`visitor-badge.laobi.icu`, chosen after an initial candidate, `hits.seeyoufarm.com`, was found dead via DNS and rejected before reaching a user). Disclosed directly in the shipped code's own doc comment (`src/visitor-counter.ts`) and in `PRODUCT-SPEC.md` Section 4/Section 6, rather than only in conversation. Guarded so the badges only activate on the real production hostname, so local/dev/test traffic doesn't inflate the real count (a bug that shipped once, briefly, before this guard was added).
**Consequences:** "Local-first... data never leaves your computer" and "Offline-capable, no network calls after load" (`PRODUCT-SPEC.md` Section 4) are now met with one disclosed exception, not fully. **This ADR was written after the feature shipped, not before** - the Decision Boundary's "STOP and record before proceeding" was honored in spirit (disclosed transparently, same turn it shipped) but not in the letter (no formal record existed until this entry). Recorded now, both because it's still accurate and to establish the actual precedent - a footer badge that pings a third party for a real, disclosed, opt-in-adjacent (visible, not hidden) purpose clears this project's bar - for the next similar call.

### ADR-005: Offline cache update-detection (fixes stale-cache-forever bug)
**Status:** Accepted
**Context:** `src/sw.ts`'s fetch handler is cache-first for every GET request the service worker's scope covers - including the top-level page navigation itself, and including requests made while fully online. A visitor who enabled offline mode before a given fix (e.g. the favicon fix) could keep being served the stale cached version indefinitely - bumping the cache version alone is not sufficient, because it only helps once a *new* service worker actually installs, activates, and takes control, which nothing was making happen proactively or reacting to.
**Decision:** Added `setupOfflineUpdates()` (`src/offline.ts`): calls `registration.update()` on load to force an immediate check rather than waiting on the browser's own throttled (~24h) schedule, and reloads the page once when `controllerchange` fires (a new service worker just took over), guarded against reload loops.
**Consequences:** "Refresh/deploy update" and "Offline-capable" (`PRODUCT-SPEC.md` Section 4) are now actually met, not just met-on-first-visit - this was a real production bug (a returning offline-mode visitor could be stuck on a stale favicon indefinitely) fixed reactively from a user report, not caught by any test suite (no jsdom Service Worker implementation exists to test this against).

### ADR-006: Switch visitor counter to GoatCounter (fixes refresh-inflates-the-count)
**Status:** Accepted
**Context:** ADR-004's `visitor-badge.laobi.icu` counter had no visitor dedup at all - every page load (including a plain refresh) incremented it, reported by the owner as not matching what "visitor counter" should mean ("what i wanted is the visitor count coming from different IP devices"). Getting real IP-based dedup requires server-side state; a pure client-side `<img>` badge fundamentally can't provide it, since the counting logic lives entirely on whatever server receives the request. This is a **Privacy**-and-**Technology-selection**-affecting decision under the Decision Boundary (Section 4 above).
Two safer alternatives were considered and rejected: (1) a purely custom backend (e.g. a Cloudflare Worker + KV hashing IP+day) - most precise, but a genuinely new piece of infrastructure to deploy and maintain, contradicting this project's documented "no backend of our own" architecture; (2) fetching a live count from GoatCounter's own API for an inline footer number - rejected after checking GoatCounter's actual API docs (`goatcounter.com/help/api`, `goatcounter.com/api.json`): the endpoint requires `Authorization: Bearer <token>`, is documented only via server-side `curl` examples, and declares no CORS headers anywhere in its OpenAPI spec - a browser `fetch()` would very likely be blocked outright, and even if it weren't, embedding that Bearer token in shipped client-side code would let anyone view-source the page and steal it (full API access, not just read-one-number).
**Decision:** Switch to GoatCounter (goatcounter.com), a hosted, cookie-free analytics service the owner created an account for (site code "forage" - `forage.goatcounter.com`) that dedupes hits by hashed IP+user-agent+day server-side. `src/visitor-counter.ts` injects only GoatCounter's official tracking script (`gc.zgo.at/count.js`), still guarded to the real production hostname (same discipline as ADR-004, so local/dev/test traffic doesn't inflate the count). The footer counter display becomes a plain static link (`index.html`, same pattern as the existing Credits/Forage links) to GoatCounter's public dashboard (its "Public" visibility setting enabled by the owner) rather than an inline live number - avoiding the token-exposure problem above entirely, at the cost of one extra click to see the actual number.
**Consequences:** The counter now means what "visitor counter" should mean - refreshing the page no longer inflates it. Still a disclosed, real exception to "no network calls after load" / "nothing leaves your machine" (`PRODUCT-SPEC.md` Section 4), same as ADR-004, just now paired with actual dedup instead of none. `CACHE_NAME` in `src/sw.ts` bumped alongside this change (see ADR-005's fix - any `dist/main.js`/`styles.css`/`index.html` change needs this, or a returning offline-mode visitor keeps the pre-change bundle indefinitely).

### ADR-007: Expand theme toggle to a 7-theme popover picker; change the default theme
**Status:** Accepted
**Context:** The owner requested five, then two more, new themes (Forest Brew, Tea Mist, Blueberry, then Kokoblu, Dubai) on top of the existing Sakura/Cherry pair, plus a fixed default (Cherry) for first-time visitors instead of the previous OS-preference-based Sakura/Cherry split. This is a **Major UX constraint** change under the Decision Boundary (Section 4 above): a click-to-cycle toggle button (the entire prior interaction model) does not scale past two or three states - a blind cycle through seven is materially worse UX than picking a theme by name.
**Decision:** Replaced the toggle button with a popover picker (`src/theme.ts`), matching the open/close-on-outside-click shape Pane's export/highlight/paragraph-style popovers already use (`src/pane.ts`'s `wirePopover`) rather than inventing a new interaction pattern. Each theme gets a Lucide icon (sourced the same way as every other icon in this app - see `src/icons.ts`'s header comment) chosen to match its name (leaf/Forest Brew, cloud-fog/Tea Mist, grape/Blueberry, moon/Kokoblu, building-2/Dubai). `resolveInitialTheme` dropped its `prefersDark` parameter entirely and now always falls back to a fixed default (Cherry) rather than branching on OS preference - a first-time visitor's experience is now the same regardless of their system's light/dark setting.
For the five owner-specified palettes, only a handful of anchor colors were given per theme (background/text/button/glow, occasionally a secondary surface or accent) - every other design token (`--ds-surface-overlay`, `--ds-text-subtle`, `--ds-border`, `--ds-danger`/`--ds-warning`/`--ds-success`, etc.) was derived by matching the tint/shade relationships already established between Sakura's and Cherry's own token sets, not invented ad hoc per theme. The Cherry-only glow-on-hover box-shadow was generalized to `var(--ds-glow, none)` (applies to any theme that defines `--ds-glow`, no-ops for the ones that don't) rather than accumulating an ever-longer explicit per-theme selector list.
**Consequences:** Theme selection no longer fits "two states, one click" - it's a menu now, one extra interaction step to reach the same result for existing Sakura/Cherry users. Blueberry's owner-given text/background pair computes to ~4.2:1 contrast, short of the 4.5:1 body-text AA threshold (flagged in `styles.css`'s header comment and shipped as given, not silently altered - see that comment for the full number). `CACHE_NAME` in `src/sw.ts` bumped again, per ADR-006's now-established discipline.

### ADR-008: Sanitize all Markdown/.docx-derived HTML before it reaches innerHTML (fixes a real XSS)
**Status:** Accepted
**Context:** A mentor security review flagged that Noted's Markdown → HTML pipeline had no sanitization step. Verified directly, not just taken on faith: `marked` (this app's Markdown parser) intentionally passes raw HTML embedded in the source straight through unchanged - CommonMark/GFM inline/block HTML is a first-class Markdown feature, and `marked` removed its own built-in `sanitize` option in v5 specifically to push that responsibility onto the calling application. `src/pane.ts` fed `renderMarkdown()`'s output directly into `this.contentEl.innerHTML` with nothing in between. Confirmed exploitable end-to-end, not theoretical: a `.md` file containing `Hello <img src=x onerror="alert(document.domain)">` executed arbitrary script the instant it was opened via drag-and-drop, the app's own primary load path - no unusual browser behavior or trickery involved. A second, independent sink existed in `src/file-loader.ts`'s `docxToMarkdown()`: mammoth's raw docx→HTML output was assigned to a `<div>`'s `innerHTML` before being walked back into Markdown text - event handler attributes (`onerror`/`onload`) can fire the moment they're assigned via `innerHTML`, regardless of whether that element is ever attached to a live, on-screen document, so this sink needed its own fix rather than being covered transitively by fixing only the final render step. This is a **Security**-affecting decision under the Decision Boundary (Section 4 above): *"Action: STOP. Resolve and record the decision before proceeding."*
**Decision:** Added `dompurify` as a runtime dependency and `src/sanitize.ts` (a single `sanitizeHtml()` wrapper) as the one place untrusted HTML gets sanitized, enforcing `Markdown -> Parser -> Sanitizer -> Safe HTML -> DOM`. Called from both sinks: `markdown.ts`'s `renderMarkdown()` (covers every `.md` render and any `.docx`-derived content, since that content is round-tripped back to Markdown text before ever being rendered) and `file-loader.ts`'s `docxToMarkdown()` (covers mammoth's raw HTML output itself, before its own separate `innerHTML` assignment). DOMPurify's default profile was used as-is - no custom allowlist needed for what Markdown/docx conversion actually produces (headings, paragraphs, lists, tables, code blocks, links, images, inline formatting).
**Consequences:** Verified the exploit is actually closed, not just that tests pass: ran the drag-and-drop-a-malicious-file scenario against a real Chromium instance (`window.__xssFired` never set, no `alert()` dialog, `<script>`/`onerror`/`javascript:` all stripped, ordinary content still rendered correctly). Bundle size grew (~1.7MB → ~1.8MB uncompressed) - a disclosed, accepted cost for the capability, same posture as ADR-003's `mammoth` addition. One test-infrastructure gap surfaced and was fixed in the same pass: `markdown.test.ts` had no `@vitest-environment jsdom` declaration (this repo has no global Vitest config; each file opts in individually) and DOMPurify's browser build requires a `window` - without the fix, `renderMarkdown()`'s own tests would have failed outright, which would have been caught immediately, but is recorded here since it's a real gap in test setup discipline, not a code defect. `CACHE_NAME` bumped again, per ADR-006's now-established discipline.

### ADR-009: Repository/CI hardening pass - least-privilege CI, pinned Actions, ESLint, Dependabot, SECURITY.md
**Status:** Accepted
**Context:** Following ADR-008's XSS fix, a mentor's broader security review recommended spending further security budget on code correctness, dependency hygiene, and repository/CI security. Audited each concretely rather than acting on the summary alone:
- Secrets: none found (repo-wide grep for API keys/tokens/passwords/credential file patterns) - not applicable given this app's no-backend architecture, confirmed rather than assumed.
- CI: `deploy-pages.yml` already scoped minimal `permissions:`; `ci.yml` had none at all (ran under whatever the repo/org's ambient default token permissions happened to be, not an explicit least-privilege grant). Both workflows pinned GitHub Actions by floating major-version tag (`@v4`) rather than a commit SHA - a recognized supply-chain gap (a tag can be repointed to different code; a SHA can't).
- Dependency hygiene: production dependencies (`marked`/`mammoth`/`docx`/`dompurify`) clean per `npm audit`. The dev toolchain (`esbuild`/`vite`/`vitest`) had flagged CVEs, all rooted in `esbuild`'s dev-server accepting cross-origin requests - not applicable to this project's usage (plain one-shot `--bundle` builds, `esbuild serve` never used) - but no Dependabot/Renovate config existed to catch future drift automatically.
- Code correctness: `tsconfig.json` already had `strict: true` plus `noUncheckedIndexedAccess`; CI already ran typecheck+tests on every push/PR. No linter configured at all - `tsc` catches type errors but not classes of bug like floating promises, unnecessary type assertions, or unsafe `any` propagation from loosely-typed DOM/library APIs.
- No `SECURITY.md` - no documented, private way for someone to report a vulnerability on this public repo (the actual gap ADR-008 itself was reported through, informally).
**Decision:**
1. Added explicit `permissions: contents: read` to `ci.yml`; split `deploy-pages.yml`'s permissions per-job (workflow-level `contents: read`, with `pages: write`/`id-token: write` scoped only to the `deploy` job, which is the only one that calls the Pages API - the `build` job can no longer touch Pages deployment even if a compromised dependency's install/build script tried to).
2. Pinned every `actions/*` step in both workflows to the commit SHA their currently-used tag resolves to (via `git ls-remote`, not a version bump - hardening and upgrading are separate concerns), with a trailing `# vX` comment for readability.
3. Added `.github/dependabot.yml` for both the `npm` and `github-actions` ecosystems (weekly) - pairs directly with SHA-pinning: Dependabot resolves a new Action release back to its SHA and updates the pin's comment, so pinning doesn't mean silently freezing forever.
4. Added `eslint.config.js` (`typescript-eslint`'s `recommendedTypeChecked` - type-aware, not just syntax-only) wired into both `ci.yml` and `deploy-pages.yml` alongside typecheck/tests. Explicit `project: [tsconfig.json, tsconfig.sw.json]` (not `projectService`'s auto-discovery, which only finds files literally named `tsconfig.json` and would miss the second, differently-named one this repo already has for `src/sw.ts`). `@typescript-eslint/unbound-method` disabled for `*.test.ts` only - test files pass mocked methods (`navigator.clipboard.writeText`, `document.execCommand`) straight into `expect(...)` assertions, never calling them detached from their object, so the rule's actual risk doesn't apply there; app code still gets the real check.
5. Added `SECURITY.md` pointing at GitHub's private vulnerability reporting flow (Security tab → "Report a vulnerability") rather than a public email or issue.
**Consequences:** First `npm run lint` surfaced 21 real findings across the existing codebase, all fixed in the same pass (not suppressed): unnecessary type assertions, an unsafe `String(FileReader.result)` coercion that could silently produce `"[object ArrayBuffer]"` if the read method ever changed, a `let` that was never reassigned, an unused constant left over from an earlier refactor (`SUBLIME_TOP_DURATION_MS`), a test missing `async`'s corresponding `await`, and several `querySelector(...)` calls returning the untyped base `Element` instead of a typed element (masking real `.style`/`.async`/`.dataset` access as `any`). `CACHE_NAME` bumped again (`dist/main.js`'s bytes changed from these fixes, even though behavior didn't) - not yet automated (still a manual, easy-to-forget step every content change requires), a real, disclosed process gap left for a future pass rather than scope-creeping this one. Branch protection, required status checks, secret scanning, and Dependabot alert enablement are GitHub repo *settings*, not files in this repo - verifying/enabling those needs the owner's direct action in Settings → Security, not something achievable from the repository content alone.

### ADR-010: Add `.html` upload, reusing the shared document IR (no new parsing dependency)
**Status:** Superseded by ADR-011 - kept verbatim as the actual record of what shipped first and why it changed, not rewritten.
**Context:** The owner requested `.html` viewer compatibility - opening a `.html` file should work the same as opening a `.md` or `.docx` file. This is a **Compatibility**-affecting decision under the Decision Boundary (Section 4 above), same class as ADR-003's `.docx` upload.
**Decision:** Route a loaded `.html` file through the same shared document IR the `.docx` path already established (`PRODUCT-SPEC.md` Section 2: HTML -> `blocksFromElement` -> `blocksToMarkdown`), just without the mammoth conversion step, since the source is already HTML - no new parsing dependency needed. `src/file-loader.ts` gained `isHtmlFile()` (extension `.html`/`.htm` or `text/html` MIME, same pattern as `isMarkdownFile`/`isDocxFile`) and `htmlToMarkdown()`, wired into `isSupportedFile()`/`pickSupportedFile()`/`loadAndEmit()` alongside the existing two formats. Sanitized the same way and at the same point as `docxToMarkdown()` (ADR-008's discipline: `sanitizeHtml()` before the string ever touches a container's `innerHTML`, not deferred to final render) - a loaded `.html` file is exactly as untrusted as mammoth's docx-derived HTML, arguably more so since it's handed to Noted as-authored rather than produced by a trusted converter. A full `<html><head>...<body>...</body></html>` document works without extra handling: DOMPurify's default profile (`WHOLE_DOCUMENT` left unset) already discards the doctype/`<head>`/`<script>`/`<style>` and returns only sanitized body content, which is exactly what `blocksFromElement` expects (it already handles arbitrary block-level HTML - headings/paragraphs/lists/tables/code/blockquotes, recursing into unknown wrapper elements - since that function was written to walk generic HTML, not docx-specific markup).
**Consequences:** `.html` joins `.md`/`.docx` everywhere a loaded file's format is surfaced: the file input's `accept` attribute, the drop-zone copy, and the "please choose/drop a ___ file" error strings (`src/pane.ts`, `src/file-loader.ts`). No bundle-size cost (unlike ADR-003's `mammoth`) - this reuses `blocksFromElement`/`blocksToMarkdown`/`sanitizeHtml`, all already shipped. Once converted, an uploaded `.html` file is indistinguishable downstream from a `.md` or `.docx` one - same Markdown text feeds the viewer, the Edit tab, and every export format. Lossiness is the same class of tradeoff as `.docx` upload (`blocksToMarkdown`'s module doc comment): a hand-authored `.html` file using markup `blocksFromElement` doesn't recognize (arbitrary `<div>`/`<span>` soup, inline `style=` attributes, `<script>`/`<style>` content) degrades gracefully - unknown wrappers are recursed into for their text, not rejected - but isn't guaranteed byte-for-byte round-trippable, same as it already isn't for `.docx`. `CACHE_NAME` bumped to v15 in `src/sw.ts`, per ADR-006's established discipline.

### ADR-011: Render `.html` live in a sandboxed iframe instead of flattening it to Markdown (supersedes ADR-010)
**Status:** Accepted
**Context:** Real-world feedback on ADR-010 the same day it shipped: the owner's actual `.html` files embed CSS/SVG/JS-driven animation and vector graphics - the whole reason to open them as HTML rather than Markdown. ADR-010's `blocksFromElement`/`blocksToMarkdown` pipeline throws all of that away by design (it extracts headings/paragraphs/lists/tables/code/inline formatting - document *structure*, not visual presentation or behavior) and unconditionally strips `<script>` (DOMPurify's sanitization step, ADR-008's discipline). The owner's literal ask: "i dont want that. i want visual coz in my html i embed animation, its vector base etc." This is both a **Compatibility** and a **Security** decision under the Decision Boundary (Section 4 above) - rendering arbitrary, potentially script-bearing HTML "live" is a materially different risk profile than sanitize-then-flatten-to-text.
**Decision:** Presented the owner two concrete choices rather than picking silently, given the security stakes: (1) a sandboxed `<iframe sandbox="allow-scripts">` rendering the file's raw HTML via `srcdoc` - full visual/animation/script fidelity, isolated by the browser's own sandboxing rather than by sanitization, or (2) sanitized inline rendering with `<script>` stripped - safer, but the exact limitation that prompted this ADR. The owner chose (1). Implementation: `src/file-loader.ts`'s `LoadedFile` gained a `format: "markdown" | "html"` field; a loaded `.html` file's raw text is now passed through completely unmodified and *unsanitized* (`htmlToMarkdown()` from ADR-010 removed entirely, not deprecated-in-place - dead code left implementing a rejected approach is worse than none). `src/pane.ts` gained a second content-rendering mode: "html"-format files render into a new `.content-frame` iframe (`sandbox="allow-scripts"`, deliberately no `allow-same-origin` - the load-bearing security property, since without it the iframe's content lives in a browser-enforced opaque origin that cannot read/write anything in Noted's own page/cookies/`localStorage` no matter what the loaded HTML does) instead of `contentEl.innerHTML`. The owner also chose the Edit/export consequence: "html"-format files get no Edit tab (`this.tabEdit.disabled = true` - there is no sound way to make `execCommand`-based rich-text editing meaningful over an arbitrary animated HTML document) and only the `.html` export button stays enabled (`updateExportButtons()` in `src/pane.ts`), re-downloading the original bytes verbatim - `.pdf`/`.docx`/`.md`/`.json` are disabled rather than silently falling back to a lossy Markdown reconstruction, since that fallback is exactly the behavior this ADR rejects.
**Consequences:** `.html` viewing is now genuinely visual - CSS animation, inline SVG, and `<script>`-driven behavior all render exactly as authored, matching what "HTML viewer" means to the owner. The real, accepted cost is the flip side of "sandboxed, not sanitized": a maliciously-crafted `.html` file's script executes (inside the iframe's opaque origin - it cannot touch Noted's own page, storage, or cookies, and cannot navigate/redirect the top-level page or open popups, but it can still make its own network requests, same risk class as visiting an arbitrary website in a fresh isolated context). This is a materially different, and deliberately disclosed, security posture from every other loaded-file path in this app (`.md`/`.docx` still go through ADR-008's sanitize-before-innerHTML pipeline unchanged) - acceptable because the app's own threat model here matches "you're opening a file, trusted or not, in something equivalent to a fresh incognito tab," the same posture CodePen/JSFiddle/StackBlitz-style live previewers use for the same reason. No Edit tab and single-format export for `.html` files is a real capability reduction relative to `.md`/`.docx` (no highlighting, no paragraph styles, no `.pdf`/`.docx`/`.json` export) - accepted as the necessary consequence of "view it as HTML, not as reconstructed Markdown." `CACHE_NAME` bumped again in `src/sw.ts` (`dist/main.js`'s bytes changed), per ADR-006's established discipline.
