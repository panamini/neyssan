# PR9 Minimal Review Cockpit

Date: 2026-06-09

## Decision

PR9 adds a pure TypeScript `ReviewCockpit` V1 model as a shadow Product Value module.

The cockpit consumes an existing `EvidenceGraphV1` and `ResumeVariantPlanV1` and returns read-first planning data for review surfaces:

```txt
EvidenceGraph + ResumeVariantPlan -> ReviewCockpitModelV1
```

It summarizes status, counts, warning items, missing evidence, blocked claims, plan items requiring review, allowed claims, and source-support items.

## Boundary

This PR is model-only and read-only.

PR9 does not:

- persist review decisions
- implement accept/reject workflows
- add generation or prompt rewriting
- create final resume text
- create polished resume bullets
- create cover-letter text
- replace CV Forge
- replace Proposal Forge
- edit `premiumCoverLetter.ts`
- add Convex schema, functions, persistence, or migrations
- mutate canonical CVs
- mutate candidate facts
- mutate EvidenceGraph
- mutate ResumeVariantPlan
- add parser, PDF, DOCX, import, export, MCP, Scout, scraping, send, apply, or tracking behavior
- change active product behavior

## Page decision

No page or shell is added in PR9.

The current safe scope is the pure model. Route integration should be a later PR after deciding the isolated review route and fixture/live-data boundary. A future PR may add a read-only page that renders `ReviewCockpitModelV1`, but it must not connect approval, generation, export, send, apply, tracking, or persistence behavior.

## Source truth

`ReviewCockpitModelV1` is a review summary over already-built source-backed structures. It does not invent claims.

Review item labels are planning-level text only. They may say that an allowed claim has source support or that a blocked claim needs review, but they must not rewrite source facts into marketing copy, resume bullets, or cover-letter paragraphs.

Generated polished text remains artifact-only and must not become source evidence.

## Status rules

The cockpit status is deterministic:

```txt
blocked if ResumeVariantPlan.blocked is true or any blocker item exists
needs_review if warning items exist and no blocker exists
ready otherwise
```

## Rollback

Rollback is deleting:

- `my-app/src/modules/review-cockpit/`
- `docs/decisions/2026-06-09-minimal-review-cockpit.md`

Then rerun the ReviewCockpit tests, ResumeVariantPlan tests, EvidenceGraph tests, candidate evidence tests, career knowledge tests, Convex shadow tests, TypeScript, and diff checks.

No database rollback, migration rollback, UI rollback, route rollback, export rollback, generation rollback, parser rollback, CV Forge rollback, Proposal Forge rollback, EvidenceGraph rollback, or ResumeVariantPlan rollback should be required.
