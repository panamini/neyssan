# PR12 ApplicationPackageV1

Date: 2026-06-10

## Purpose

PR12 adds a pure TypeScript `ApplicationPackageV1` boundary to the Application OS chain.

The boundary references already-built resume variant and cover-letter artifacts in one deterministic, provenance-backed package object.

```txt
ResumeVariantArtifactV1
+ CoverLetterArtifactV1
+ package metadata
-> ApplicationPackageV1
```

## Package boundary, not workflow

`ApplicationPackageV1` is a package boundary only.

It is not an approval workflow. It is not export. It is not send, apply, track, or submission behavior. It does not create PDF or DOCX files. It does not call generation. It does not change Proposal Forge or CV Forge.

Future package workflows can consume this model in later PRs after explicit gates exist.

## Input and output boundary

Input is limited to:

- `userId`
- `applicationContextId`
- `ResumeVariantArtifactV1`
- `CoverLetterArtifactV1`
- `createdAt`
- `updatedAt`

Output is an `ApplicationPackageV1` plus an `ApplicationPackageContentV1` wrapper when requested.

PR12 does not require direct ApplicationContext, EvidenceGraph, ResumeVariantPlan, or ReviewCockpit input because the included artifacts already carry the upstream source-chain provenance.

## Status rules

Status is deterministic:

```txt
blocked if ResumeVariantArtifact.status is blocked
blocked if CoverLetterArtifact.status is blocked
needs_review if ResumeVariantArtifact.status is needs_review or draft
needs_review if CoverLetterArtifact.status is needs_review or draft
ready_for_review only if ResumeVariantArtifact.status is ready_for_generation and CoverLetterArtifact.status is ready_for_review
else draft
```

`ready_for_review` means the package is structurally ready for human review. It does not mean approved, exported, sent, submitted, applied, or tracked.

PR12 intentionally does not add approval, export, send, apply, track, or submission fields.

## Hash semantics

`buildApplicationPackageHash(input)` is the identity hash used for `package.id`.

It excludes `createdAt` and `updatedAt`.

It includes stable identity inputs:

- `userId`
- `applicationContextId`
- resume artifact id and status
- cover-letter artifact id and status

`buildApplicationPackageContentHash(package)` is a separate content/change-detection hash.

It excludes `id`, `createdAt`, and `updatedAt`, and includes meaningful package content such as status, artifact refs, items, warnings, blocker reason, provenance, and version.

## Provenance union rules

Package provenance is the sorted, deduped union of provenance IDs from `ResumeVariantArtifactV1` and `CoverLetterArtifactV1`.

The package stores:

- source fact IDs
- allowed claim IDs
- evidence match IDs
- demand IDs
- risk flag IDs
- review item IDs

It does not invent provenance IDs, collapse provenance into prose, store raw source document text, store full CV text, or store full cover-letter text.

## Lightweight package items

Package items reference artifact IDs and content hashes only.

They may include generic labels, notices, warnings, and blockers.

They must not duplicate resume prose, cover-letter text, raw source documents, full CV text, or rendered output.

## Forbidden scope

PR12 does not change UI, routes, Convex schema/functions/persistence, parser/import, generation, prompts, LLM behavior, Proposal Forge, CV Forge, export, PDF/DOCX, active CV snapshots, user profile behavior, job behavior, EvidenceGraph, ResumeVariantPlan, ReviewCockpit, ResumeVariantArtifact, CoverLetterArtifact, MCP, Scout, or internal tool contracts.

## Tests

PR12 adds focused Vitest coverage for deterministic package IDs, timestamp-independent identity, artifact identity changes, content hash semantics, input consistency validation, status derivation, warning and blocker derivation, artifact refs, package items, provenance union, sorted collectors, content wrapper output, generated-text guard scope, input non-mutation, absence of forbidden imports, raw text exclusion, and deterministic output order.

## Rollback

Rollback is deletion-only:

```txt
delete my-app/src/modules/application-package/
delete docs/decisions/2026-06-10-application-package-v1.md
rerun tests/typecheck
```

No database, migration, UI, route, generation, export, parser, CV Forge, Proposal Forge, EvidenceGraph, ResumeVariantPlan, ReviewCockpit, ResumeVariantArtifact, CoverLetterArtifact, MCP, Scout, internal-tool, approval, send, apply, track, or submission rollback should be required.

## Deferred work

Deferred work includes internal tool contracts, MCP, Scout, persistence, review UI, export/PDF/DOCX, approval gates, send/apply/track flows, and ChatGPT App work.
