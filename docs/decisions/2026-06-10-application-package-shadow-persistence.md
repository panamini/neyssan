# Application package shadow persistence

Date: 2026-06-10
Status: accepted for PR14
Scope: additive Convex shadow persistence only

## Objective

PR14 adds Convex shadow persistence for existing `ApplicationPackageV1` objects.

The goal is to make application packages durable for later internal review, generation, and export workflows without changing active product behavior in this PR.

## Storage boundary

The `applicationPackages` table stores:

- indexable package metadata
- resume and cover-letter artifact ids
- provenance id rollups
- package hash and content hash
- the full `ApplicationPackageV1` payload
- timestamps and version

This table is internal-only. It does not add public queries, public mutations, UI routes, generation, export, send/apply/track behavior, approval workflow, audit events, Scout, or MCP adapters.

## Create-or-reuse

Writes use deterministic `applicationPackageId`.

If the same id and same payload are inserted again, the existing row is reused. If the same id is reused with a different package hash, content hash, or package payload, the write fails with a deterministic conflict.

This prevents silent overwrite while keeping shadow persistence idempotent.

## Explicit non-goals

PR14 does not:

- mutate canonical CVs
- mutate candidate facts
- mutate source documents
- replace CV Forge or Proposal Forge
- edit `premiumCoverLetter.ts`
- store raw source documents
- store full CV text
- store full job text
- store generated final resume text outside the package payload
- store cover-letter text as a separate top-level field
- store PDF, DOCX, or export output
- store tool execution logs
- store approval or rejection decisions

## Rollback

Rollback is deletion-only:

- delete `my-app/convex/applicationPackages.ts`
- delete `my-app/convex/lib/applicationPackages.ts`
- delete `my-app/convex/__tests__/applicationPackages.test.ts`
- remove `applicationPackages` from `my-app/convex/schema.ts`
- delete this decision document
- rerun Convex codegen, focused tests, TypeScript, and diff check
