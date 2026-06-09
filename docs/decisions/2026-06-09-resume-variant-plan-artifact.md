# PR8 ResumeVariantPlan Artifact

Date: 2026-06-09

## Decision

PR8 adds pure TypeScript `ResumeVariantPlan` V1 primitives as a shadow Product Value module.

A `ResumeVariantPlan` is reviewable planning data that sits after the PR7 `EvidenceGraph` and before any future resume/CV generation. It records which allowed claims can support a resume/CV variant, which sections may need planning actions, and which missing evidence or risk flags must be reviewed first.

## Boundary

This is a plan artifact only.

PR8 does not:
- generate final resume text
- generate polished resume bullets
- generate cover-letter text
- mutate canonical CV data
- mutate candidate facts
- mutate the EvidenceGraph
- replace CV Forge
- replace Proposal Forge
- edit `premiumCoverLetter.ts`
- add Review UI
- add UI or routes
- add Convex schema, functions, persistence, or migrations
- add parser, PDF, DOCX, import, export, MCP, Scout, or scraping behavior
- change active product behavior

## Source truth

`ResumeVariantPlan` consumes the `EvidenceGraph`, not raw unsupported facts.

Every claim-backed plan item must map back to:
- one or more allowed claim IDs
- one or more candidate fact IDs
- accepted evidence matches where available
- related demand IDs where available

Unsupported claims are flagged rather than fabricated. Missing evidence and risk flags become warnings and review/block plan items.

Private, pending, rejected, `never_use`, and generated artifact text are excluded from claim-backed plan items. Generated polished text remains artifact-only and must not become source evidence.

## Artifact shape

`ResumeVariantPlanArtifactContentV1` is pure content data:

```txt
kind: resume_variant_plan
plan: ResumeVariantPlanV1
version: 1
```

PR8 does not persist this artifact content. Future persistence or Review UI work must happen in a separate PR.

## Rollback

Rollback is deleting:

- `my-app/src/modules/resume-variant-plan/`
- `docs/decisions/2026-06-09-resume-variant-plan-artifact.md`

Then rerun the ResumeVariantPlan tests, EvidenceGraph tests, candidate evidence tests, career knowledge tests, Convex shadow tests, TypeScript, and diff checks.

No database rollback, migration rollback, UI rollback, route rollback, export rollback, generation rollback, parser rollback, CV Forge rollback, Proposal Forge rollback, or EvidenceGraph rollback should be required.
