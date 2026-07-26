# Candidate evidence kernel

Date: 2026-06-09  
Status: accepted for PR 4  
Scope: pure TypeScript source-truth primitives only

## Decision

Add a narrow `candidate-evidence/` TypeScript module that defines planning-level V1 primitives for candidate source documents, candidate facts, deterministic source paths, and import batch identity.

This PR adds:

- `CandidateSourceDocumentV1`
- `CandidateFactV1`
- `CandidateImportBatchV1`
- deterministic SHA-256 hash helpers for source documents, facts, and import batches
- source-path normalization and validation guards
- source-truth guardrails that reject generated artifact-like fact material

## Source truth boundary

Candidate facts preserve source truth. They represent reviewable facts extracted from or manually tied to source material. They are not polished resume bullets, cover-letter claims, proposal copy, or final application text.

Source documents are source material, not final truth. A pasted profile, Markdown note, uploaded CV, LinkedIn export, LinkedIn PDF, portfolio material, freelance export, or manual entry can become a source document, but derived facts still require review before use.

Polished generated text belongs only in generated artifacts. It must not become canonical candidate fact material.

## What this PR intentionally does not build

This PR does not parse PDFs or DOCX files.

This PR does not scrape LinkedIn, logged-in LinkedIn pages, Upwork, Indeed, or any remote source.

This PR does not persist source documents, candidate facts, or import batches.

This PR does not add Convex schema, Convex functions, migrations, or active route wiring.

This PR does not change CV Forge, Proposal Forge, generation, parser/import, export, JobsWorkspace, active CV snapshots, or routes.

## Deferred

Deferred until explicitly scoped:

- `CandidateEvidenceProfile`
- `CareerKnowledge`
- `EvidenceGraph`
- `ResumeVariantPlan`
- Review UI
- candidate evidence Convex shadow persistence
- PDF/DOCX parsing or import pipeline
- source-document review workflows
- product behavior that selects facts for generation

## Rollback

Rollback is trivial:

- delete `my-app/src/modules/candidate-evidence/`
- delete `docs/decisions/2026-06-09-candidate-evidence-kernel.md`

No database rollback, migration rollback, UI rollback, route rollback, or product behavior rollback is required.
