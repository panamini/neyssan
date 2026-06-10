# PR11 Cover-letter Artifact Adapter

Date: 2026-06-10

## Purpose

PR11 adds a pure TypeScript `CoverLetterArtifact` V1 boundary to the Application OS chain.

The boundary represents caller-supplied cover-letter text as deterministic, reviewable data derived from an existing `ResumeVariantArtifactV1`.

```txt
ResumeVariantArtifactV1
+ caller-supplied cover-letter text
+ caller-supplied source metadata
-> CoverLetterArtifactV1
```

## Adapter, not generation

PR11 is an adapter only.

It does not generate, rewrite, summarize, improve, polish, or add cover-letter prose. It does not call an LLM, Proposal Forge generation, or `premiumCoverLetter.ts`.

Existing generated output may be preserved only when another caller supplies it as plain artifact text with `sourceKind: "existing_generated_output"`. That source kind records origin; it does not create generation behavior in this module.

Generation quality tuning is deferred. Future generation improvements should consume this artifact or be reviewed in a separate PR.

## Input and output boundary

Input is limited to user/context ids, a `ResumeVariantArtifactV1`, exact `sourceText`, source kind, text format, optional compact source metadata, optional language/market, and timestamps.

Output is a `CoverLetterArtifactV1` plus a `CoverLetterArtifactContentV1` wrapper when requested.

PR11 does not require Convex documents, persistence, canonical CV input, Proposal Forge mutations, exports, UI routes, or ApplicationPackageV1.

## Exact text preservation

`artifact.text.value` is exact pass-through from `input.sourceText`.

The builder must not trim, normalize, rewrite, summarize, improve, or add paragraphs to `sourceText`.

Text-derived metadata is deterministic:

- `characterCount` equals `input.sourceText.length`
- `paragraphCount` is computed on a trimmed copy only
- `textHash` is derived from exact text, format, and source kind

## Status rules

Status is deterministic:

```txt
blocked if ResumeVariantArtifact.status is blocked
draft if supplied sourceText is empty or whitespace-only
needs_review if ResumeVariantArtifact.status is needs_review or draft and sourceText is non-empty
ready_for_review only if ResumeVariantArtifact.status is ready_for_generation and sourceText is non-empty
```

`ready_for_review` does not mean approved, final, exported, sent, or submitted.

PR11 intentionally does not add `approved`, `final`, `exported`, `sent`, or `submitted` states.

## Hash semantics

`buildCoverLetterArtifactHash(input)` is the identity hash used for `artifact.id`.

It excludes `createdAt` and `updatedAt`.

It includes stable identity/content inputs: user/context ids, language/market, resume artifact id and status, exact supplied text, source kind, format, and source metadata when provided.

`buildCoverLetterArtifactContentHash(artifact)` is a separate content/change-detection hash.

It excludes `id`, `createdAt`, and `updatedAt`, and includes meaningful artifact content such as status, text, source metadata, warnings, blocked reason, provenance, and version.

## Provenance inheritance

`CoverLetterArtifactV1.provenance` is inherited from `ResumeVariantArtifactV1.provenance`.

The adapter adds the upstream `resumeVariantArtifactId` and a resume artifact content hash while preserving source-backed provenance arrays for source facts, allowed claims, evidence matches, demands, risk flags, and review items.

The module does not collapse provenance into prose, invent provenance IDs, store raw source document text, or store full CV text.

## Forbidden scope

PR11 does not change UI/routes, Convex schema/functions/persistence, export/PDF/DOCX, prompt code, LLM behavior, Proposal Forge, CV Forge, `premiumCoverLetter.ts`, active product behavior, EvidenceGraph, ResumeVariantPlan, ReviewCockpit, ResumeVariantArtifact, ApplicationPackageV1, or PR12 work.

## Tests

PR11 adds focused Vitest coverage for deterministic artifact IDs, exact text preservation, text metrics, text hashing, timestamp-independent identity, content hash semantics, status derivation, validation failures, provenance inheritance, sorted unique collectors, input non-mutation, generated-text guard scope, and absence of generation/prompt/LLM imports.

## Rollback

Rollback is deletion-only:

```txt
delete my-app/src/modules/cover-letter-artifact/
delete docs/decisions/2026-06-10-cover-letter-artifact-adapter.md
rerun tests/typecheck
```

No database, migration, UI, route, generation, export, parser, CV Forge, Proposal Forge, EvidenceGraph, ResumeVariantPlan, ReviewCockpit, ResumeVariantArtifact, ApplicationPackageV1, or PR12 rollback should be required.

## Deferred work

Deferred work includes generation quality tuning, prompt changes, LLM behavior changes, persistence, UI review flows, export/PDF/DOCX, ApplicationPackageV1, and package-level approval/submission states.
