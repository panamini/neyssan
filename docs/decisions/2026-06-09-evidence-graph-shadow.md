# PR7 EvidenceGraph Shadow

Date: 2026-06-09

## Decision

PR7 adds pure TypeScript EvidenceGraph V1 primitives as a shadow Proof-layer module.

The EvidenceGraph maps job demands to approved source-backed candidate facts. It records deterministic evidence matches, missing evidence, risk flags, and source-grounded allowed claims.

## Boundary

This is a provenance and source-support layer, not a generator.

PR7 does not:
- generate or rewrite prompts
- create polished resume bullets
- create cover-letter paragraphs
- replace Proposal Forge
- replace CV Forge
- edit `premiumCoverLetter.ts`
- add Review UI
- add `ResumeVariantPlan`
- add Convex schema, functions, or persistence
- change active product behavior

## Source truth

Candidate facts remain the source-truth layer. Generated polished text remains artifact-only.

Allowed claims are extracted or minimally normalized from approved `use_in_applications` candidate facts. They are not marketing copy, final resume text, or cover-letter text.

Unsupported claims are flagged rather than fabricated.

Private, pending, rejected, and `never_use` facts are excluded from allowed claims. `never_use` and private facts produce explicit risk flags when they would otherwise be relevant.

## Career knowledge

CareerKnowledge rules can attach deterministic rule IDs to risk flags. They do not mutate candidate facts, generate claims, or act as a policy engine in PR7.

## Rollback

Rollback is deleting:

- `my-app/src/modules/evidence-graph/`
- `docs/decisions/2026-06-09-evidence-graph-shadow.md`

Then rerun the EvidenceGraph-adjacent tests, candidate evidence tests, career knowledge tests, Convex shadow tests, TypeScript, and diff checks.
