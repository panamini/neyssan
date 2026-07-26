# Controlled ATS Scout Adapters

Date: 2026-06-10
Status: accepted narrow PR14 implementation
Scope: pure TypeScript Distribution-layer ATS adapter primitives

## Purpose

PR14 adds a controlled ATS Scout adapter boundary for caller-supplied ATS payloads.

The module normalizes known Greenhouse, Lever, and Ashby payload fixture shapes into deterministic `ControlledAtsJobLeadV1` records. It is a pure adapter layer only.

## Why Controlled Adapters Only

The Application OS chain now has typed package and internal contract boundaries. This PR adds the next Distribution-layer primitive:

```txt
caller-supplied ATS payload
+ supported vendor descriptor
-> deterministic normalized job leads
```

PR14 does not fetch jobs.
PR14 does not crawl.
PR14 does not scrape.
PR14 does not persist job leads.
PR14 does not create ApplicationContext.
PR14 does not add MCP.
PR14 does not add Scout runtime.
PR14 does not expose public APIs.
PR14 does not add export/send/apply/track behavior.

Future runtime adapters should consume these pure adapters in later PRs.

## Runtime Deferral

Runtime Scout is deferred because live discovery needs separate approval, audit, permission, transport, and persistence boundaries.

Network access is deferred because PR14 must be deterministic and deletion-safe. Payloads are supplied by the caller and normalized locally.

LinkedIn, Upwork, and Indeed scraping are forbidden because they cross product, compliance, and platform-risk boundaries. They are not supported vendors and are rejected by URL/vendor guards.

## Supported Vendors

- Greenhouse
- Lever
- Ashby

## Unsupported And Forbidden Vendors

Forbidden vendors:

- LinkedIn
- Upwork
- Indeed
- generic web
- unknown scraper

These are never registered as adapters.

## Payload Boundary Rules

- `payload` is caller-supplied.
- PR14 does not retrieve payloads.
- PR14 supports simple fixture-shaped payloads only.
- Malformed individual records are rejected without rejecting valid sibling records.
- Unsupported whole-payload shapes return deterministic rejected records.
- Supplied job descriptions are preserved as supplied and are not summarized or rewritten.

## Hash Semantics

- `rawPayloadHash` hashes the supplied raw record or unsupported payload deterministically.
- `leadHash` excludes `createdAt` and `updatedAt`.
- `leadHash` includes stable lead inputs such as vendor, source kind, canonical URL, external job ID, title, location, status, description hash, compensation, and raw payload hash.
- Lead IDs are `controlled-ats-job-lead:<leadHash>`.

## Dedupe Rules

Leads dedupe by stable key preference:

```txt
vendor + externalJobId
vendor + canonicalUrl
vendor + leadHash
```

Output order is deterministic by vendor, title, canonical URL, external ID, and ID.

## Validation Rules

The module validates:

- supported vendors only
- supported source kinds only
- finite metadata timestamps
- required non-empty titles
- supported ATS URL hosts only
- forbidden vendor URL hosts
- duplicate adapter vendors
- deterministic registry ordering
- compensation finite numbers when present
- metadata guard strings for runtime, scraping, auto-apply, resume prose, and cover-letter prose

## Forbidden Scope

This PR does not change:

- UI or routes
- Convex schema, functions, or persistence
- generation or prompts
- parser/import
- export/PDF/DOCX
- `premiumCoverLetter.ts`
- Proposal Forge or CV Forge
- JobsWorkspace
- active CV snapshots, `userProfiles`, or jobs behavior
- EvidenceGraph, ResumeVariantPlan, ReviewCockpit, artifacts, ApplicationPackage, or InternalToolContracts behavior
- MCP, ChatGPT App, browser automation, or network clients

## Tests

Focused Vitest coverage verifies:

- deterministic registry and registry hash
- scout content shape
- supported vendor registry
- duplicate and forbidden vendor rejection
- URL inference and canonicalization guards
- Greenhouse, Lever, and Ashby fixture normalization
- malformed record rejection
- raw payload and lead hash determinism
- timestamp-independent lead identity
- description preservation
- deterministic dedupe and output ordering
- immutability
- absence of forbidden imports, helper names, and runtime behavior
- generated-text guard behavior

## Rollback Notes

Rollback is deletion-only:

```txt
delete my-app/src/modules/controlled-ats-scout/
delete docs/decisions/2026-06-10-controlled-ats-scout-adapters.md
rerun tests/typecheck
```

No database, migration, UI, route, generation, export, parser, CV Forge, Proposal Forge, jobs table, MCP, Scout runtime, or network rollback should be required.

## Deferred Work

- Local MCP beta
- Runtime Scout orchestration
- Approval and audit events
- Persistence for approved job leads if later needed
- Public API or ChatGPT App work
