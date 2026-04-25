# Job Surface Overlap Audit

Date: 2026-04-23

Scope: active `v1` job-facing surfaces only

Relevant files:
- `my-app/src/pages/JobsPage.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/ProposalBriefCard.tsx`
- `my-app/src/components/CoverLetterStartSurface.tsx`
- `my-app/convex/jobsPublic.ts`

## Design Framing

Visual thesis:
- Jobs should feel like a calm decision desk. Proposal Forge should feel like a writing desk.

Content plan:
- Jobs = triage first, dossier second, action third.
- Proposal Forge = write first, context second, intake only when blank.

Interaction thesis:
- list scan should be low-friction and dense
- proposal context should collapse when writing starts
- intake should behave like a guided fork, not a job artifact card

## Active Code Classification

- `my-app/src/pages/JobsPage.tsx`: active code
- `my-app/src/pages/ProposalForge.tsx`: active code
- `my-app/src/components/ProposalBriefCard.tsx`: active code
- `my-app/src/components/CoverLetterStartSurface.tsx`: active code
- `my-app/convex/jobsPublic.ts`: active code

## Verified Facts

1. Jobs and Proposal Forge already share one canonical job data source: `jobsPublic.getById`.
2. Jobs page uses that record as a full dossier surface: title/meta, `MatchReadBlock`, `NextStepBlock`, then `ProposalBriefCard`.
3. Proposal Forge uses the same canonical job record in a different stage: `ProposalBriefCard` renders inside the compose column when `canonicalJobId` exists.
4. Proposal Forge also has a separate intake surface, `CoverLetterStartSurface`, but that surface is not a job card. It is a route chooser for blank-state cover-letter start.
5. The real overlap is not `JobsPage` row vs Proposal Forge intake. The real overlap is `JobsPage` detail vs `ProposalBriefCard` inside Proposal Forge.
6. The list row in Jobs is already a different product object: it is an inbox row with scan metadata and inline resume attachment.

## Pipeline

### Jobs pipeline

1. `JobsPage` loads the job list with summary fields for scan.
2. Selecting a row navigates to `/jobs/:jobId`.
3. `JobsPage` then loads `jobsPublic.getById`.
4. That detail record powers:
   - title and company header
   - `MatchReadBlock`
   - `NextStepBlock`
   - `ProposalBriefCard`
5. `Generate cover letter` routes to `/proposal?jobId=...`.

### Proposal Forge pipeline

1. `ProposalForge` derives `canonicalJobId` from route state/query.
2. If there is no `canonicalJobId`, no handoff, no attached CV, and no meaningful draft, it may show `CoverLetterStartSurface`.
3. Once a canonical job exists, `ProposalForge` loads `jobsPublic.getById`.
4. That same record is transformed into proposal prefill and into the brief surface.
5. `ProposalBriefCard` renders in either `compact` or `card` mode depending on compose layout state.

## Surface Comparison

### 1. Jobs list row

Purpose:
- triage and reopen

Current heuristic:
- good for scan
- good for status density
- good place for inline per-job CV affordance
- not appropriate for raw source or editing

Why it exists:
- it answers `which job should I open?`

Recommendation:
- keep distinct

### 2. Jobs detail page

Purpose:
- operational dossier and action hub

Current heuristic:
- strongest decision surface
- combines evaluation (`MatchReadBlock`), recommendation (`NextStepBlock`), and evidence (`ProposalBriefCard`)
- best place for job-specific resume attachment because the user is still deciding how to act on this job

Why it exists:
- it answers `should I act on this job, and what is the right next move?`

Recommendation:
- keep as the canonical decision surface

### 3. Proposal Forge start surface

Purpose:
- blank-state intake router

Current heuristic:
- good for reducing blank-page anxiety
- good for sequencing first actions
- not a job artifact surface

Why it exists:
- it answers `how do I begin when there is no job and no resume in context?`

Recommendation:
- do not fuse with Jobs card patterns

### 4. Proposal Forge brief surface

Purpose:
- keep job context visible while writing

Current heuristic:
- good as secondary context
- should stay subordinate to the compose surface
- already correctly collapses into a compact mode on desktop

Why it exists:
- it answers `what job am I writing against right now?`

Recommendation:
- share structure with Jobs detail, but not with Jobs list row

## Where They Overlap

There are two layers of overlap:

1. Data overlap
- Jobs detail and Proposal Forge brief are already reading the same canonical job record.

2. Component overlap
- both surfaces already use `ProposalBriefCard`

This means the product already partially chose the right architecture:
- one canonical job brief component
- different containers around it for different stages

## Where They Conflict

The main conflict is semantic, not visual.

`ProposalBriefCard` is currently doing two jobs:
- in Jobs, it behaves like a job brief
- in Proposal Forge, its `documentTitle` can become the proposal title instead of the job title

That creates a product ambiguity:
- is this card about the source job?
- or is it about the output document?

For a writer, that distinction matters. The proposal title is output context. The job title is source context. Those should not be the same field.

## Product Read

Do not fuse everything into one job card.

That would blur three distinct moments:
- triage
- decision
- writing

These moments need different heuristics:

- triage needs density and scan speed
- decision needs trust, evaluation, and recommended action
- writing needs quiet context that can collapse

Trying to force one component across all three would make each one worse.

## Best Product Architecture

### Keep different

- Jobs list row
- Proposal Forge start surface

### Fuse more deliberately

- Jobs detail evidence block
- Proposal Forge brief block

Those two should come from the same `JobBriefPanel` design language.

## Recommended Refactor Direction

### Canonical model

Split the current shared brief surface into:

1. `JobBriefPanel`
- source job title
- source platform / source link
- trust state
- extracted summary
- review items
- linked documents
- raw source dock

2. container-specific wrappers
- `JobsDecisionPanel`
- `ProposalContextPanel`

### Rules

- `JobsDecisionPanel` may compose:
  - header identity
  - `MatchReadBlock`
  - `NextStepBlock`
  - `JobBriefPanel`

- `ProposalContextPanel` may compose:
  - compact or expanded `JobBriefPanel`
  - never primary CTA density
  - never become visually louder than the compose form

- `CoverLetterStartSurface` stays separate and should never inherit the job-brief visual language

## Design Recommendation

### Jobs

Make Jobs the authoritative place for:
- match judgement
- trust judgement
- resume attachment
- next-step recommendation

### Proposal Forge

Make Proposal Forge the authoritative place for:
- writing
- toggling context depth
- seeing only the minimum job context needed to write well

### Shared language

Share:
- source badge language
- trust pill language
- linked-document language
- review-item editing patterns
- raw-source dock language

Do not share:
- intake routing UI
- inbox row structure
- action density

## Bottom Line

The surfaces should not become one card.

They should become one system with three roles:

1. job inbox row
2. job decision dossier
3. writing context panel

The existing code is already close to that architecture. The main missing step is to stop treating `ProposalBriefCard` as both a job title surface and a proposal title surface. That semantic split is the highest-value design cleanup before any visual unification.
