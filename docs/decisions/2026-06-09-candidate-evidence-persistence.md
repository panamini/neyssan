# Candidate evidence persistence

Date: 2026-06-09
Status: accepted for PR 6
Scope: additive Convex shadow persistence only

## Decision

Add Convex shadow persistence for PR4 candidate-evidence source-truth primitives:

- candidate source document identity/hash/metadata shells
- candidate facts
- candidate import batch shells
- internal create/reuse, read/list, and patch helpers

This is shadow persistence only. It does not add routes, UI, generation, parser/import workflow, product behavior, public Convex functions, or active generation/profile integration.

## Source document boundary

Source documents are stored as identity/hash/metadata shells only. The tables persist sourceType, optional title/filename/mime metadata, textHash, sourceHash, review state, visibility, timestamps, and version.

They do not store raw full source text, parsed PDF text, DOCX text, LinkedIn scrape content, import payloads, or generated application artifacts.

## Candidate facts

Candidate facts preserve source truth. Each fact stores sourceDocumentId, sourcePath, optional sourceQuote, factType, source value, optional normalizedText/confidence, reviewState, visibility, timestamps, and version.

Pending facts are durable but not automatically eligible for generation. Later systems must still honor reviewState and visibility before using candidate facts.

Review state and visibility are persisted for later Review UI and EvidenceGraph work. `private` and `never_use` remain first-class states, but this PR does not wire product behavior that selects or exports facts.

## Fact value validator

`candidateFacts.value` uses Convex `v.any()` because fact shapes vary by factType. The write helper guards it before insert by:

- validating sourcePath through the PR4 source-path helper
- rejecting generated artifact-like values through the PR4 source-truth helper
- rejecting functions, promises, class instances, sparse arrays, circular records, symbol keys, and non-Convex-compatible JSON-like values

This does not permit raw source documents, generated polished text, application artifacts, or full import payloads to become canonical candidate fact values.

## Explicit non-goals

No parser/import pipeline.

No PDF/DOCX extraction.

No LinkedIn import or scraping.

No generation or prompt rewrite.

No UI or Review Cockpit.

No EvidenceGraph.

No ResumeVariantPlan.

No CandidateEvidenceProfile builder.

No current product behavior changes.

## Rollback

Before production reliance, rollback is deleting:

- candidate evidence tables from `my-app/convex/schema.ts`
- `my-app/convex/candidateEvidence.ts`
- `my-app/convex/lib/candidateEvidence.ts`
- `my-app/convex/__tests__/candidateEvidence.test.ts`
- this decision doc

Then run Convex codegen, focused Vitest coverage, TypeScript, diff check, and status check.

No UI, route, export, generation, parser, JobsWorkspace, active CV snapshot, or userProfiles rollback should be required.
