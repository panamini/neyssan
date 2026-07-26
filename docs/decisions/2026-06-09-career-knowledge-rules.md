# Career knowledge rules

Date: 2026-06-09
Status: accepted for PR 5
Scope: pure TypeScript static rules and resolver only

## Decision

Add a narrow `career-knowledge/` TypeScript module that defines deterministic V1 rules for later application-proof work.

This PR adds static rule primitives and a resolver only. It does not add generation, prompt rewriting, UI, EvidenceGraph, ResumeVariantPlan, parser/import work, persistence, Convex schema, Convex functions, routes, export changes, or active product behavior.

## Boundary

CareerKnowledge gives later PRs a source of deterministic rule constraints for source truth, claim safety, resume/CV heuristics, cover-letter guidance, review gates, and market/style context.

Rules are conservative heuristics. They must not pretend to be legal advice, hiring advice, ATS certification, immigration advice, or exhaustive international compliance.

## Deferred

- generation and prompt integration
- review cockpit or UI
- EvidenceGraph
- ResumeVariantPlan
- parser, PDF, DOCX, or import work
- persistence and Convex integration
- export, send, submit, apply, or tracking behavior

## Rollback

Rollback is trivial:

- delete `my-app/src/modules/career-knowledge/`
- delete `docs/decisions/2026-06-09-career-knowledge-rules.md`

No database rollback, migration rollback, UI rollback, route rollback, export rollback, or product behavior rollback is required.
