---
doc_id: REPO-STANDARD
authority: governance-process
retrieval_purpose: >
  Full Cross-Functional Product Development SOP, compiled in one place from
  PRODUCT-SPEC.md Section 7 (Repository Architecture) and
  PRODUCT-DECISIONS.md Section 3 (Sections 2-10: Source of Truth, Development
  Model, Decision Boundary, Assumption Control, Architectural Decisions,
  Change Management, Definition of Done, Modification Rules, Traceability
  Requirement). Load before modifying this repository (see Section 9).
  Identical process to the human-kernel sibling repo's REPO-STANDARD.md -
  this SOP is project-agnostic.
consult_when: [before-repository-modification, onboarding, sop-reference]
skip_when: never — Section 9 requires reading this file before modification
depends_on:
  - PRODUCT-SPEC.md
  - PRODUCT-DECISIONS.md
source_files:
  - "docs/product/PRODUCT-SPEC.md"
  - "docs/product/PRODUCT-DECISIONS.md"
compiled: 2026-08-11
never_paraphrase: true
---

# REPO-STANDARD.md

REPOSITORY STANDARD
Cross-Functional Product Development SOP

**Model:** Agile, iterative, incremental
**Scope:** All serious product and software repositories
**Priority:** Repository integrity, traceability, controlled change

## 1. REPOSITORY ARCHITECTURE

```
project/
├── .github/
│   └── workflows/
│
├── docs/
│   ├── product/
│   │   ├── PRODUCT-SPEC.md
│   │   ├── PRODUCT-PRINCIPLES.md
│   │   ├── PRODUCT-ROADMAP.md
│   │   └── PRODUCT-DECISIONS.md
│   │
│   ├── ux/
│   │   ├── RESEARCH.md
│   │   ├── USER-FLOWS.md
│   │   ├── INFORMATION-ARCHITECTURE.md
│   │   └── wireframes/
│   │
│   ├── ui/
│   │   ├── DESIGN-SYSTEM.md
│   │   ├── COMPONENTS.md
│   │   └── specifications/
│   │
│   ├── technical/
│   │   ├── ARCHITECTURE.md
│   │   ├── DATA-MODEL.md
│   │   ├── API.md
│   │   └── DESKTOP.md
│   │
│   ├── qa/
│   │   ├── TEST-PLAN.md
│   │   ├── TEST-CASES.md
│   │   ├── ACCEPTANCE-CRITERIA.md
│   │   └── BUGS.md
│   │
│   └── decisions/
│       └── ADR/
│
├── src/
│   ├── frontend/
│   └── desktop/
│
├── data/
│   ├── sample/
│   └── schema/
│
├── assets/
├── scripts/
│
├── README.md
├── REPO-STANDARD.md
├── CHANGELOG.md
├── ROADMAP.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE
├── package.json
└── .gitignore
```

### Applicability

- Omit components that are not applicable.
- Do not create empty directories.
- Do not introduce alternative locations for the same concern.
- Preserve established project conventions unless they conflict with this standard.

> **Note (current repo state):** `docs/product/`, `README.md`, `REPO-STANDARD.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`, `package.json`, and `src/` exist. `docs/ux/`, `docs/ui/`, `docs/technical/`, `docs/qa/`, `docs/decisions/ADR/`, `data/`, `assets/`, `scripts/`, `.github/workflows/` are not yet created - add each only when a concern it holds actually exists. Root `ROADMAP.md` is intentionally omitted: `docs/product/PRODUCT-ROADMAP.md` is the single authoritative roadmap location (Section 2 below, Rule "Do not duplicate specifications").

## 2. SOURCE OF TRUTH

| Concern | Authoritative location |
|---|---|
| Product intent | `docs/product/PRODUCT-PRINCIPLES.md` |
| Requirements | `docs/product/PRODUCT-SPEC.md` |
| Roadmap | `docs/product/PRODUCT-ROADMAP.md` |
| UX | `docs/ux/` |
| UI | `docs/ui/` |
| Technical architecture | `docs/technical/` |
| QA | `docs/qa/` |
| Architectural decisions | `docs/decisions/ADR/` and `docs/product/PRODUCT-DECISIONS.md` Section 11 |
| Implementation | `src/` |
| Data structure | `data/schema/` |
| Material changes | `CHANGELOG.md` |

Rules:

- One authoritative source per concern.
- Do not duplicate specifications.
- References may point to the authoritative source.
- Resolve conflicts before implementation.
- Repository artifacts supersede undocumented conversational context.

## 3. DEVELOPMENT MODEL

Use iterative development.

```
Requirement
→ Design
→ Implement
→ Test
→ Review
→ Learn
→ Reprioritize
→ Next increment
```

Requirements may change when new evidence appears.

Material changes must update the affected source of truth.

Do not silently change requirements.

## 4. DECISION BOUNDARY

Classify unresolved information before proceeding.

### LOW IMPACT

Examples:

- Naming
- Minor spacing
- Local implementation details
- Reversible cosmetic choices

**Action:** Proceed using established conventions.

### MATERIAL

Affects:

- Feature behavior
- User flow
- Information architecture
- Acceptance criteria
- Externally observable behavior

**Action:** Record assumption or resolve before implementation when the ambiguity materially affects the result.

### HIGH IMPACT

Affects:

- Architecture
- Data model
- Security
- Privacy
- Authentication
- Storage
- API contracts
- Platform
- Deployment
- Compatibility
- Major dependencies
- Regulatory/compliance constraints
- Irreversible technical decisions

**Action:** STOP. Resolve and record the decision before proceeding.

## 5. ASSUMPTION CONTROL

When proceeding with an assumption that may affect future work, record:

```
UNKNOWN:
IMPACT:
ASSUMPTION:
STATUS:
```

An assumption must not silently become a requirement.

If the assumption becomes material, convert it into an explicit decision.

## 6. ARCHITECTURAL DECISIONS

Use:

```
docs/decisions/ADR/
```

Create an ADR for material decisions affecting:

- Architecture
- Data
- Security
- Infrastructure
- Technology selection
- Interoperability
- Major UX constraints
- Maintainability

ADR minimum structure:

```
# ADR-NNN: Title

Status:
Context:
Decision:
Consequences:
```

Do not create ADRs for trivial implementation choices.

## 7. CHANGE MANAGEMENT

For every material change:

1. Identify affected source(s) of truth.
2. Assess impact.
3. Update requirement/specification if necessary.
4. Implement the smallest coherent change.
5. Test.
6. Update affected documentation.
7. Update `CHANGELOG.md` when user-visible, architectural, or otherwise material.

Do not restructure a repository solely for aesthetic consistency.

## 8. DEFINITION OF DONE

A material feature is complete only when applicable:

```
Requirement
→ Acceptance criteria
→ Design
→ Implementation
→ Verification
→ Documentation
→ Release
```

A feature may be considered complete without every documentation artifact when that artifact is genuinely not applicable.

## 9. MODIFICATION RULES

Before modifying an existing repository:

1. Read `REPO-STANDARD.md`.
2. Read relevant requirements.
3. Inspect relevant ADRs.
4. Inspect affected implementation.
5. Identify conflicts and dependencies.
6. Determine decision boundaries.
7. Implement.
8. Verify.
9. Update affected records.

Do not assume missing information is permission to invent requirements.

Do not block development for low-impact ambiguity.

## 10. TRACEABILITY REQUIREMENT

For material functionality, the repository should support this chain:

```
Product intent
→ Requirement
→ Design
→ Technical decision
→ Implementation
→ QA verification
→ Release
→ Change record
```

Break the chain only where a stage is genuinely not applicable.
