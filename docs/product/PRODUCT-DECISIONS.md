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
