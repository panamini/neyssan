# Pure application-harness kernel

Date: 2026-06-08  
Status: accepted for PR 1  
Scope: pure TypeScript identity primitives only

## Decision

Add a narrow `application-harness/` TypeScript module that defines stable application identity shells and deterministic fingerprint helpers.

This module includes:

- `SourceRefV1`
- `ApplicationContextV1`
- `ApplicationRunV1`
- `ApplicationArtifactV1` shell
- `ApplicationEventV1` shell
- stable serialization for JSON-like/plain-object inputs, with Date support
- SHA-256 stable hash helpers
- source-reference hashing
- application-run idempotency keys
- numeric millisecond timestamps

## Why this is pure and additive

The harness is an identity and replay-safety layer. It does not own product behavior, persistence, generation, parsing, review UI, export, routes, or agent/platform adapters.

Keeping this PR pure TypeScript makes the rollback boundary small: delete the new module and this decision doc.

## Why persistence is deferred

Persistence belongs in a later shadow PR after the identity format is stable and tested. This PR intentionally avoids Convex schema changes, Convex functions, migrations, and active route imports.

## Why generation, UI, routes, and platform work are out of scope

The current CV, proposal, export, parser/import, job workspace, and generation flows must keep working unchanged while the application harness is introduced.

Adding UI, generation calls, route wiring, MCP, Scout, or durable workflows here would couple a foundational identity primitive to product behavior before the replay and provenance model is proven.

## Why SourceRefV1 is included early

`SourceRefV1` gives context, runs, and artifacts a stable way to point back to originating job, CV, proposal, artifact, or later candidate-evidence sources.

It is a type only in this PR. It is not a table and it does not imply source-document persistence.

## Why ApplicationEventV1 is type-only

`ApplicationEventV1` reserves a minimal event shell for future audit and review flows without creating an event table before there is a concrete audit use case.

## Why SHA-256 and numeric timestamps

Durable hashes use SHA-256 hex digests to align with the existing job-text hash pattern in `convex/lib/jobs/llmExtractJob.ts`.

Harness timestamps use numeric millisecond values so future persistence and comparison logic can avoid string-date parsing ambiguity.

## Persistence preflight hardening

Before Convex persistence, the harness identity contract requires three additional guardrails:

- Candidate hashes require an explicit candidate identity anchor: either `sourceKind: "cv"` with `cvId`, or `sourceKind: "candidate_evidence_profile"` with `candidateEvidenceProfileId`.
- Hash namespace ownership is centralized in `fingerprints.ts` so idempotency keys and fingerprint helpers cannot drift onto different namespace strings.
- `ApplicationContextV1.job.rawTextHash` should be populated with `buildRawJobTextHash(rawDescription)` instead of an ad hoc caller-defined hash.

These guardrails keep PR2 shadow persistence from storing ambiguous candidate hashes, namespace-drifted idempotency keys, or inconsistent raw job text hashes.

## How this prepares idempotent application workflows

Stable hashes and idempotency keys let future steps identify when the same user, operation, context hash, and input hash have already been processed.

That prepares later PRs to reuse work safely, avoid accidental overwrites, and make generated artifacts traceable back to deterministic context inputs.

## Deferred

- Convex persistence
- context builder
- Career Vault
- candidate source documents and facts
- EvidenceGraph
- ResumeVariantPlan
- Review UI
- Scout
- MCP
- generation changes
- export changes
