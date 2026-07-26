# Application OS master plan

Date: 2026-06-08
Status: accepted direction, phased execution
Scope: architecture sequencing and Codex execution boundaries

## Status and scope

This document records the accepted Twoweeks Application OS direction.

It is a planning and control artifact. It is not a Codex implementation task. Do not paste this document into Codex as a request to build the whole system.

Codex must receive one narrow PR-specific prompt at a time.

## Product thesis

Twoweeks is an AI job-application operating system.

The product should let a user bring a job opportunity and produce a truthful, reviewable application packet:

```txt
job
-> stable application context
-> evidence-backed match
-> resume variant plan
-> tailored resume artifact
-> cover-letter artifact
-> human review
-> approved export
-> tracked application
```

Twoweeks is not a generic job scraper, a blind AI resume generator, or an auto-apply bot.

## Current baseline

Existing flows must keep working during migration:

- CV/profile ingestion
- canonical saved profile/CV data
- CV Forge
- Proposal Forge
- JobsWorkspace
- job records
- match review
- proposal and cover-letter generation
- export
- active CV snapshots
- Chrome extension handoff

## Architecture layers

### Spine

Owns durable identity and replay safety.

```txt
application-harness/
  SourceRefV1
  ApplicationContextV1
  ApplicationRunV1
  ApplicationArtifactV1 shell
  ApplicationEventV1 shell
  fingerprints
  idempotency
```

### Proof

Owns source truth and claim safety.

```txt
candidate-evidence/
  CandidateEvidenceProfileV1
  CandidateSourceDocumentV1
  CandidateFactV1
  import batches
  dedupe
  review states
  visibility and privacy

career-knowledge/
  ATS rules
  resume and CV rules
  cover-letter rules
  claim-safety rules
  market resolver

evidence-graph/
  JobDemandGraphV1
  EvidenceGraphV1
  allowed claims
  missing requirements
  risk flags
```

### Product value

Owns reviewable user outcomes.

```txt
resume-variants/
  ResumeVariantPlanV1
  resume variant artifacts

application-review/
  read-first approval cockpit

application-packages/
  approved application packet
```

### Distribution

Owns agent interfaces only after internal services are stable.

```txt
agent-tools/
  internal typed tool contracts

mcp/
  local or remote adapter later
```

MCP is an adapter over Twoweeks business logic. It must not own business logic.

## Hard invariants

1. The master architecture plan is documentation, not a Codex task.
2. Codex receives exactly one narrow PR-specific prompt at a time.
3. Build the spine first.
4. Delay platform and distribution work.
5. Use `application-harness/`, not `application-core/`.
6. `application-harness/` is narrow and is not a workflow engine.
7. The harness may own deterministic fingerprints, idempotency, context identity, run identity, artifact identity, and provenance references.
8. The harness must not own UI, generation, parsing, export, active routes, Scout, MCP, or product workflows.
9. Candidate facts must preserve source truth.
10. AI may classify, dedupe, extract metadata, and propose review states, but must not rewrite candidate facts into polished resume claims.
11. Polished generated text belongs only in generated artifacts.
12. Every generated claim must map back to approved source facts or be flagged as unsupported.
13. Canonical CVs must not be mutated when generating tailored variants.
14. Candidate evidence profiles must not be mutated when generating variants.
15. Approval gates are required before export, tracking, send, submit, or apply.
16. `SourceRefV1` is type-only early.
17. `ApplicationEventV1` is type-only until audit needs are real.

## PR sequencing

The first three PRs are one foundation block:

```txt
PR1 - pure TypeScript application-harness kernel
PR2 - additive Convex shadow persistence for contexts, runs, and artifact shells
PR3 - shadow ApplicationContext builder from existing job and CV/profile data
```

No Career Vault import, EvidenceGraph, ResumeVariantPlan, Review UI, Scout, MCP, ChatGPT App, generation changes, or export changes are allowed before PR1-3 are complete and tested.

Later PRs may add proof, product value, and distribution layers only when the foundation block is stable and each step has its own narrow prompt.

## Source and privacy rules

Source material is sensitive.

Allowed later, after the foundation block:

- pasted text
- Markdown
- user-uploaded LinkedIn export
- user-uploaded LinkedIn profile PDF
- uploaded CVs
- user-supplied Upwork or freelance exports
- project lists
- user-supplied portfolio material
- manual facts

Rules:

- Each import is a source document, not final truth.
- Source documents parse into pending candidate facts.
- Pending facts require review before becoming eligible.
- Private facts must never enter public CVs, cover letters, exports, MCP outputs, or application packages.
- `never_use` facts must never be selected.
- Raw source documents must not be sent wholesale to generation prompts.
- Deleting or rejecting a source document must make derived pending facts ineligible unless the user explicitly preserves them.
- Portfolio material is user-supplied but untrusted until fetched or sanitized, stored as source material, parsed into pending facts, and reviewed.

## Forbidden actions for MVP

- LinkedIn scraping
- logged-in LinkedIn crawling
- anti-bot bypass
- Upwork scraping
- Indeed scraping
- automated apply
- automated submit
- automated send
- mutating canonical CVs during generation
- mutating source candidate facts into marketing copy
- exporting before approval
- tracking before approval

Safe LinkedIn paths are user-uploaded LinkedIn data export, user-uploaded LinkedIn profile PDF, pasted profile text, or manually entered facts.

## Execution workflow

GPT Pro is for senior architecture review, source-grounded planning, PR prompt generation, and PR review.

Codex is for repository execution only after receiving one PR-specific prompt.

Each execution cycle should follow this loop:

1. GPT Pro writes or reviews one narrow PR prompt.
2. Codex reads `AGENTS.md` and the named source files first.
3. Codex implements only the scoped PR.
4. Codex runs the narrowest relevant verification.
5. Codex reports changed files, tests, failures, uncertainties, and unexpected touches.
6. GPT Pro reviews the real diff and report.
7. If blocking issues exist, GPT Pro produces a fix-forward prompt.
8. If safe, GPT Pro produces the next narrow PR prompt.

Do not continue the roadmap from an unreviewed or failing PR.

## Stop conditions

Stop immediately and review if a PR touches or attempts to add:

- CV Forge UI
- Proposal Forge UI
- proposal generation prompts
- `premiumCoverLetter.ts`
- export changes
- parser/import rewrites
- Convex schema outside the scoped persistence PR
- Convex functions outside the scoped persistence PR
- MCP implementation
- Scout or job-source adapters
- browser automation
- Career Vault UI
- EvidenceGraph implementation
- ResumeVariantPlan implementation
- ApplicationPackageV1 table before scoped
- campaigns
- Google, Drive, or Docs integration
- apply, send, or submit actions
- canonical CV mutation
- active route behavior changes
- package dependencies
- deletion of legacy support
- removal of current tests
- broad formatting or style rewrites
- opportunistic cleanup
- unrelated docs rewrites
- active module renames
- existing folder moves
- remote or network behavior

## Deferred

Deferred until explicitly scoped:

- Convex persistence, except PR2
- context builder, except PR3
- Career Vault
- candidate source documents and facts
- EvidenceGraph
- ResumeVariantPlan
- Review UI
- Scout
- MCP
- ChatGPT App
- generation changes
- export changes

## Rollback

Rollback is trivial: delete this decision document.
