---
doc_id: PRODUCT-PRINCIPLES
authority: governing-philosophy
retrieval_purpose: >
  Operating methodology and decision filters: ABIM (full, shared verbatim
  with the human-kernel sibling repo - it is project-agnostic), MVD (full),
  Noted's own design concept, operating principle, and mission filter. This
  is the judgment layer, not the implementation layer.
consult_when: [product-boundary-judgment, build-no-build-call, scope-filter,
  re-induction-after-evidence, assumption-control]
skip_when: routine execution already inside an established MVD boundary
depends_on: []
related:
  - PRODUCT-SPEC.md
  - PRODUCT-ROADMAP.md
  - PRODUCT-DECISIONS.md
authored: 2026-08-11
integrity: >
  Sections 1-2 (ABIM, MVD) are the same project-agnostic methodology used by
  the human-kernel sibling repo, reproduced in full rather than referenced by
  pointer, per that repo's own `never_paraphrase` convention. Sections 3-5
  are specific to Noted and have no human-kernel equivalent (human-kernel's
  "Three Laws of the Kernel" and "Mission Filter (Evidence Vault)" are about
  a personal-pattern-compiler product and do not apply here). Section 1's
  original ABIM subsections (1-18) and Section 2 (MVD) remain byte-identical
  to the shared source - the one addition, Section 19 (Practical Operating
  Loop), is a new, clearly-marked addendum applied identically across the
  Noted, human-kernel, and S2-Week3 copies (2026-08-12), not a modification
  of the existing reproduced text.
never_paraphrase: true
---

# PRODUCT-PRINCIPLES.md

## 1. ABIM — Agile Backward-Induction Project Management

**Version:** 0.2
**Status:** Experimental operating methodology
**Use:** Solo product, creative technology, software, knowledge systems, AI-assisted production

### 1. Core Principle

> **Think backward from the desired outcome. Build forward in small deliveries. Validate against reality. Re-induce from evidence.**

ABIM combines:

- Agile iteration
- Backward induction
- Design thinking
- MVD
- Resource reuse
- Lean experimentation
- Lightweight governance
- AI-agent orchestration

**Primary objective:** minimize unnecessary work while preserving delivery discipline.

### 2. Operating Loop

```text
PROBLEM
  ↓
OUTCOME
  ↓
BACKWARD INDUCTION
  ↓
CAPABILITY
  ↓
REQUIREMENT
  ↓
RESOURCE / PATTERN SEARCH
  ↓
MVD
  ↓
BUILD
  ↓
VALIDATE
  ↓
EVIDENCE
  ↓
RE-INDUCE
  ↓
NEXT MVD
```

The loop is non-linear. Evidence can invalidate earlier assumptions and send the project backward.

### 3. Outcome Before Feature

Do not start with:

> What feature should we build?

Start with:

> What should the user be able to see, understand, decide, or accomplish?

Preferred outcome test:

> **"After using this, the user can now see ____."**

If a feature has no clear outcome, **defer, modify, or remove it**.

### 4. MVD

> Build the smallest complete delivery that produces the intended outcome.

MVD should have:

- Essential functionality
- Low delivery complexity
- Cohesive experience
- Fast usability

Do not optimize for feature count. Optimize for **visible outcome**.

### 5. Backward Induction

Work backward from outcome to implementation.

```text
OUTCOME
  ↑
USER BEHAVIOR
  ↑
EXPERIENCE
  ↑
CAPABILITY
  ↑
REQUIREMENT
  ↑
COMPONENT
  ↑
IMPLEMENTATION
```

At each level:

> **What must be true for the previous level to work?**

Do not assume a component or feature is necessary. Derive it from the desired outcome and observable user behavior.

### 6. Forward Execution

Once the MVD is defined:

```text
MVD → DESIGN → BUILD → INTEGRATE → TEST → RELEASE
```

**Backward induction determines what to build.**

**Forward execution determines how to build it.**

### 7. Resource Arbitrage

Before building, search for suitable existing solutions.

```text
REUSE → COMPOSE → ADAPT → BUILD
```

Search: open-source software, libraries, models, datasets, standards, infrastructure, UX patterns, documentation, existing project artifacts.

Do not rebuild solved infrastructure without a reason.

### 8. Pattern Mining

Treat existing products as a pattern library.

```text
DESIRED EXPERIENCE
  ↓
EXISTING PRODUCTS
  ↓
PATTERN EXTRACTION
  ↓
COMPARISON
  ↓
RECOMBINATION
  ↓
NEW SOLUTION
```

Extract interaction, navigation, information architecture, visual hierarchy, data representation, feedback, and workflow patterns.

Innovation should focus on the actual problem or useful recombination, not novelty for its own sake.

### 9. Design Thinking

Use design thinking primarily for **problem framing and validation**.

Minimum sequence:

```text
OBSERVE → DEFINE → OUTCOME → PROTOTYPE → TEST
```

For solo work, use evidence gathering and structured reflection instead of workshops.

### 10. Agile

```text
PLAN → BUILD → TEST → RELEASE → LEARN → ADAPT
```

ABIM changes the planning unit from generic task completion to **outcome-driven MVD delivery**. An iteration should produce useful capability or evidence.

### 11. Validation

```text
MVD → BUILD → TEST → REAL USE → OBSERVATION → EVIDENCE
```

**BUILT ≠ VALIDATED**

Evidence states: **VALIDATED** / **PARTIALLY VALIDATED** / **INVALIDATED** / **UNKNOWN**.

### 12. Re-Induction

When evidence contradicts the current model, do not automatically add features. Move backward:

```text
FEATURE
  ↑
CAPABILITY
  ↑
USER BEHAVIOR
  ↑
OUTCOME
```

Locate the failed assumption. Possible actions: **CONTINUE | MODIFY | REDUCE | REPLACE | DEFER | KILL**.

### 13. Assumption Control

```text
UNKNOWN
  ↓
HYPOTHESIS
  ↓
TESTING
  ↓
VALIDATED / INVALIDATED
```

Never allow an assumption to silently become treated as fact.

### 14. Lightweight Governance

Track only information that materially affects execution: scope, time, resources, risks, dependencies, decisions, quality, constraints, evidence.

### 15. Agent Protocol

**Before acting:** read project index; identify current outcome; identify current MVD; read relevant specifications; identify assumptions; search existing resources; confirm contribution to the current MVD.

**During execution:** stay within MVD boundary; reuse before rebuilding; record consequential decisions; surface contradictions; separate facts from assumptions; do not silently expand scope.

**Before completion, verify:** essential functionality; cohesive experience; fast enough; acceptance criteria met; no critical blockers; intended outcome visible. **Then record:** delivered, worked, failed, unknown, next step. Return to backward induction.

### 16. Anti-Patterns

Detect and resist: feature accumulation, scope drift, premature architecture, reinvention, ceremony without decision value, false completion, founder confirmation bias, over-documentation, technology-first development.

### 17. Master Decision Filter

```text
1. WHAT OUTCOME?
2. WHAT USER CHANGE?
3. WHAT MUST BE TRUE?
4. DOES THIS WORK CONTRIBUTE?
5. CAN WE REUSE SOMETHING?
6. WHAT IS THE SMALLEST COHERENT DELIVERY?
7. HOW WILL WE VALIDATE IT?
```

If the work cannot answer these, **pause and reassess before implementation**.

### 18. ABIM Operating Model

> **Reason backward. Reuse existing solutions. Deliver the smallest coherent useful increment. Build forward. Validate against reality. Treat evidence as superior to assumption. Re-induce when reality disagrees. Repeat.**

```text
OUTCOME
→ BACKWARD INDUCTION
→ RESOURCE ARBITRAGE
→ MVD
→ BUILD
→ VALIDATE
→ EVIDENCE
→ RE-INDUCE
→ NEXT MVD
```

### 19. Practical Operating Loop (Applied)

**Addendum, not a replacement.** The operating loop above (Sections 2 and 18) is the abstract model. In practice, delivery under this method has converged on a more concrete five-step loop, stated here because it's how work actually gets driven day to day, and because evidence from applying it (see the Noted project's `docs/retrospective/RETROSPECTIVE-ABIM-PROCESS-MAPPING.md` for the full account) surfaced one real gap worth codifying rather than leaving as an unstated habit.

```text
Think of a feature
  → Rapid prototyping
  → Realign with closest in industry by feature & tool
  → Redesign UI so it's coherent with the rest & follow the design system
  → Verify (test + typecheck/build + a real-environment check for anything
     that can't be faithfully verified any other way)
  → Commit & push
```

Mapped to the abstract model above: "think of a feature" is Outcome-Before-Feature (Section 3) compressed into a single step; "realign with closest in industry by feature & tool" is Resource Arbitrage (Section 7) and Pattern Mining (Section 8) made concrete and named explicitly rather than left implicit; "redesign UI for design-system coherence" is MVD's own "cohesive design system" requirement (Section 2) applied per-feature, not just at the whole-product level; "commit & push" is Forward Execution's release step (Section 6).

**The step worth naming explicitly: Verify.** A stated loop that goes straight from "redesign UI" to "commit & push" has no named place for validation - and `BUILT ≠ VALIDATED` (Section 11) is not satisfied by a feature merely looking finished. Concretely, in the evidence this addendum is based on, the costliest bugs shipped were ones that looked complete at exactly the point a loop without an explicit Verify step would stop - they were only caught because a verification pass (automated tests, typechecking, a full build, and a real-browser/real-environment check for anything a synthetic test environment can't faithfully model) was inserted as a matter of habit, not because the stated loop required it. Restated with the step made explicit is the version above; omitting it is the anti-pattern to watch for (see Section 16, `False completion`).

**Minimum Viable Delivery** is the smallest complete delivery that produces the intended user outcome.

### MVD Requirements

- **Essential functionality** - only what is required for the core outcome.
- **Easy to complete** - low implementation complexity and short delivery cycle.
- **Cohesive design system** - consistent enough to feel like one system.
- **Fast load** - performance is part of viability.

### MVD Filter

Every feature must complete this sentence:

> **"After using this, the user can now see ____."**

The blank must describe a concrete insight, relationship, state, or decision-relevant result. If a feature cannot produce a meaningful answer, **defer or remove it**.

### Scope Rule

Build the smallest delivery that proves the core insight. Do not add features merely because they are technically possible, aesthetically appealing, convenient, scalable, interesting, or expected in a conventional product of this category.

**MVD = minimum functionality required to make the intended insight visible.**

## 3. Design Concept

1. **Open specification + forkable implementation + local ownership.** MIT-licensed, no closed telemetry, no server dependency for core function - a file you drop into Noted is never sent anywhere.
2. **The file is the source of truth, not the app.** Noted reads and renders/edits a `.md` file; it does not own, lock in, or reformat it into a proprietary store. Export produces plain, portable output (`.html`, `.pdf`, `.docx`) - never a Noted-only format.
3. **Deterministic rendering.** The same Markdown input produces the same rendered output every time - no hidden per-session state silently changing how a file looks.

## 4. The Operating Principle

> **Does this help the user read, write, compare, or carry their own notes - without leaving the browser, installing anything, or losing control of the file?**

Examples:

Drag-and-drop load? Yes - removes the "where did I save that" friction.
Dual-pane compare? Yes - makes differences between two files visible without a separate diff tool.
Export to portable formats? Yes - the file leaves Noted exactly as usable as it arrived.
A plugin marketplace? Maybe not, for v1 - increases surface area without a proven outcome yet (see `PRODUCT-ROADMAP.md`).
Cloud sync? Maybe not - conflicts with "the file never leaves your machine" unless a user deliberately opts in later.

## 5. Mission Filter (Noted v1)

Do not build "a note-taking platform."

Build a **single moment of magic**:

"I dragged my note in. I could read it, mark it up, compare it against another, and take it back out in whatever format I needed - and it never left my browser."

That is enough to prove the category.
