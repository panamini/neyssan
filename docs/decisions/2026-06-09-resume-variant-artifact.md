# PR10 Resume Variant Artifact

Date: 2026-06-09

## Decision

PR10 adds a pure TypeScript `ResumeVariantArtifact` V1 model as a shadow Product Value module.

The artifact is derived from the already-built source-backed chain:

```txt
EvidenceGraph
-> ResumeVariantPlan
-> ReviewCockpit
-> ResumeVariantArtifact
```

It is a reviewable resume/CV variant artifact boundary, not final generation, not a resume editor, and not export.

## Boundary

PR10 adds a pure model only.

PR10 does not:

- mutate canonical CVs
- mutate candidate facts
- mutate candidate evidence profiles
- mutate source documents
- mutate active CV snapshots
- mutate EvidenceGraph
- mutate ResumeVariantPlan
- mutate ReviewCockpit
- replace CV Forge
- replace Proposal Forge
- edit `premiumCoverLetter.ts`
- add UI or routes
- add generation or prompt rewriting
- add export, PDF, or DOCX behavior
- add parser/import behavior
- add Convex schema, functions, persistence, or migrations
- persist review decisions
- store raw source document text
- store full CV text
- store generated final resume text
- start PR11 cover-letter artifact work
- add or change `ApplicationPackageV1`

## Source truth

`ResumeVariantArtifactV1` consumes `EvidenceGraphV1`, `ResumeVariantPlanV1`, and `ReviewCockpitModelV1`.

It preserves provenance instead of generating final copy. Source-backed artifact items point back to allowed claims, source facts, evidence matches, demands, risk flags, and review items.

Artifact labels and notes are planning-level metadata only. They must not be polished resume bullets, marketing copy, or cover-letter paragraphs.

## Status rules

The artifact status is deterministic:

```txt
blocked if ResumeVariantPlan is blocked or ReviewCockpit is blocked
needs_review if ReviewCockpit needs review
ready_for_generation only when ReviewCockpit is ready and at least one source-backed item exists
draft otherwise
```

`ready_for_generation` does not mean approved, final, exported, sent, or submitted. A later PR may generate from this artifact only after review gates exist.

## Deferred

ApplicationPackageV1 remains deferred.

PR11 cover-letter artifact remains deferred.

Persistence, UI, routes, export, PDF/DOCX, parser/import, and generation integration remain deferred.

## Rollback

Rollback is deleting:

- `my-app/src/modules/resume-variant-artifact/`
- `docs/decisions/2026-06-09-resume-variant-artifact.md`

Then rerun the ResumeVariantArtifact tests, ReviewCockpit tests, ResumeVariantPlan tests, EvidenceGraph tests, candidate evidence tests, career knowledge tests, Convex shadow tests, TypeScript, and diff checks.

No database rollback, migration rollback, UI rollback, route rollback, export rollback, generation rollback, parser rollback, CV Forge rollback, Proposal Forge rollback, EvidenceGraph rollback, ResumeVariantPlan rollback, ReviewCockpit rollback, ApplicationPackageV1 rollback, or PR11 rollback should be required.
