# Jobs Page Audit

Date: 2026-04-23

Scope: active `v1` jobs flow only

Relevant files:
- `my-app/src/pages/JobsPage.tsx`
- `my-app/src/components/ProposalBriefCard.tsx`
- `my-app/src/pages/CvForge.tsx`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/lib/jobs/canonicalJobs.ts`
- `my-app/src/components/onboarding/QuickStartFlow.tsx`

## Active Code Classification

- `my-app/src/pages/JobsPage.tsx`: active code
- `my-app/convex/jobsPublic.ts`: active code
- `my-app/convex/lib/jobs/canonicalJobs.ts`: active code
- `my-app/src/pages/CvForge.tsx`: active code
- `my-app/src/components/ProposalBriefCard.tsx`: active code
- `my-app/convex/jobs.ts`: legacy for LLM jobs, not the jobs page authority

## Verified Facts

1. The jobs page is a two-pane list/detail workspace, not a columnar "Obsidian-like" information architecture.
2. `Tailor resume` does not perform tailoring logic. It routes to `/cv?jobId=...` and shows the saved job brief as context inside `CvForge`.
3. `Do both` opens the resume route in a new tab and starts the proposal flow in the current tab.
4. The saved job object does not currently have a dedicated `skills` field. It stores `summary`, `responsibilities`, `keywords`, `mustHaves`, `toneCues`, and `contacts`.
5. The current parser is heuristic and shallow. It slices the first sentences for responsibilities and reuses the full raw description as review evidence.
6. `Needs attention` is only driven by `parseStatus === "failed"`. It is not a richer triage state.
7. The current tests cover render/approve/happy-path quick start, but they do not cover edit-save on job review items, failed parse triage, or a job-library entry inside quick start.

## Main Product Read

The current page is structurally useful as an internal object browser, but it is not yet commercially strong enough to be the front door of a "job-centric" workflow.

It currently underperforms on the benchmark categories that matter most:

- UX/Flow: weak
- AI Quality + AI UX: weak to medium
- Import/Parsing/Reliability: weak
- Onboarding/Activation: weak
- Brand Trust: weak
- Retention potential: strong, if the object model is upgraded

The page has long-term leverage because the `job` object is already linked to proposals and can anchor resume/proposal reuse. But right now it reads more like parser output inspection than a confident job workspace.

The deeper issue is not only parser quality.

The deeper issue is decision latency:

- the user should know quickly whether the job is relevant
- the user should know quickly whether they are plausibly qualified
- the user should know quickly what to do next

If the page exposes structured data but still forces heavy interpretation, it is not done.

## KPI Risk

Most exposed KPIs:

- Decision Time
- Import Success / Trust
- Visitor -> First Draft Rate
- Job Saved Rate
- Time to First Draft
- Job to First Doc Time
- Resume Import Review Completion Rate
- AI Rewrite Accept Rate
- Jobs Imported per User
- Proposal Generation From Saved Job
- Linked Documents per Job
- Duplicate / Retarget Usage
- Documents per User

Current risk:

- users see a noisy job brief
- users do not understand what each CTA truly does
- users cannot quickly scan multiple jobs
- parser noise creates distrust before any document generation starts
- users still have to think too hard before acting

## Success Metrics

Core metrics to track for the jobs surface:

- Time to Decision
- Jobs Imported per User
- Job Saved Rate
- Job to First Doc Time
- Proposal Generation From Saved Job
- Linked Documents per Job
- Duplicate / Retarget Usage

Recommended additions:

- Job Open Rate After Save
- Job Review Completion Rate
- Import Accept Rate
- Import Fix vs Accept Ratio
- User Correction Rate on Extracted Fields
- Editable Summary Save Rate
- Resume Open From Saved Job
- Resume Export After Saved Job Context
- Saved Job Reopen Rate at D7 / D30

Interpretation:

- `Time to Decision` is the north-star UX metric for this surface. It matters before `Job to First Doc Time`.
- `Jobs Imported per User` and `Job Saved Rate` measure acquisition into the object model.
- `Job to First Doc Time` measures whether the library accelerates output or adds friction.
- `Proposal Generation From Saved Job` measures whether the object is truly actionable.
- `Linked Documents per Job` measures whether a job becomes a reusable workspace anchor.
- `Duplicate / Retarget Usage` is the strongest later retention signal.
- `Import Accept Rate`, `Fix vs Accept Ratio`, and `User Correction Rate` measure whether the import actually helped or just created cleanup work.

These fit the broader KPI framework for activation, import trust, and retention.

## Direction

The jobs page should become an instant decision + immediate action surface.

Upgrade of the core principle:

- not only `job = reusable work object`
- but `job = decision engine + reusable work object`

The surface should become:

1. left column = navigable job inbox
2. center column = normalized job brief + interpretation
3. right column = actions and linked artifacts

That is the "Obsidian column" direction worth pursuing, but only after the semantics become clearer than the layout.

Multi-column is acceptable only if:

- each column has one obvious role
- density stays low
- the first viewport answers the next-action question
- the layout reduces thinking rather than increasing it

If the layout becomes visually richer before it becomes semantically clearer, it will regress comprehension.

## Ship / Do Not Ship

Ship:

- Job object
- Job Library page
- extension save-to-library flow
- open job -> Proposal Forge handoff
- linked documents on each job
- editable extracted summary

Do not ship yet:

- notes
- activity timeline
- batch generation
- batch apply queues
- advanced ATS / CRM features
- complex status systems

Rationale:

- The current risk is not lack of feature breadth.
- The current risk is weak trust, weak scanability, slow decision-making, and unclear handoff value.
- Adding CRM weight before the core object is reliable would slow activation and make the product feel heavier in minute 1.

## Main Surfaces

### 1. Job Library

A lightweight list of saved jobs.

Each row or card should show:

- job title
- company
- source
- status
- last activity
- linked resume count
- linked cover letter count

Recommended additions for first useful scan:

- compensation if known
- contract / duration if known
- location / remote mode
- trust state
- one-line summary

The row should answer one question in under five seconds:

`Is this job worth opening right now, and what work is already attached to it?`

Better version:

`Should I act on this job now, and if yes, what is the next best action?`

### 2. Job Detail

The opened job should not feel like raw pasted text with parser fragments.

It should expose:

- normalized summary
- match signal
- gap signal
- recommended action
- key responsibilities
- key skills / keywords
- must-haves
- source metadata
- linked documents
- clear next actions

The detail pane should be optimized for:

- deciding whether to use the job
- fixing noisy extraction
- branching into resume or proposal work

Outcome-first examples:

- `Strong match` / `Partial match` / `Weak match`
- `Missing 3 key requirements`
- `Best angle: stakeholder coordination + process reliability`
- `Recommended action: generate proposal` / `open CV with job context` / `skip for now`

### 3. Forge Handoff

The transition from Job Library -> Proposal Forge or CV Forge should preserve context without overselling automation.

Required behavior:

- stable job context
- explicit source attribution
- linked document continuity
- no ambiguity about whether the app is only opening context or actively tailoring content

## Outcome-First UX

The current product vocabulary is still too data-shaped:

- summary
- responsibilities
- keywords

The better product vocabulary is outcome-shaped:

- match quality
- missing requirements
- best angle
- next action

The rule is:

- extraction is necessary
- interpretation is differentiating
- recommendation is what reduces cognitive load

The system should move from:

- extract -> show -> user interprets

to:

- extract -> interpret -> recommend

## AI Value Clarity

For this surface, AI should not stop at raw extraction.

AI should add visible value by producing:

- a compact match signal
- gap detection
- best-angle synthesis
- action recommendation

This is also where product trust improves:

- the user can see what AI concluded
- the user can see why
- the user can accept, edit, or ignore it

Without this layer, the page is still closer to a parser review tool than an AI workflow.

## Import Feedback Loop

Import quality cannot be treated as invisible plumbing.

The product needs an explicit feedback loop:

- confidence signal
- accept / edit / reject behavior
- field-level correction measurement
- import fix vs accept ratio

That loop is needed for both:

- product trust
- parser improvement prioritization

## Recommended Near-Term Priorities

P0
- Replace naive job parsing with a compact normalized job brief model.
- Add match signal, gap detection, best-angle synthesis, and single recommended action.
- Clarify CTA semantics: `Generate cover letter`, `Open resume with job context`, `Open both workspaces`.
- Add a real quick-start bridge: `Pull a job from library`.
- Redefine trust states so `Needs attention` means actionable triage, not only parser failure.
- Add import accept/correction instrumentation so import quality is measurable, not assumed.

P1
- Add standardized summary fields: compensation, contract type, duration, location, availability, seniority, start date, remote/hybrid, language, visa, stack.
- Add fast job browsing cards with 5-second scanability.
- Add explicit "Use this job" / "Fix this brief" actions in the list.

P2
- Build candidate-vs-job comparison as a first-class system.
- Use saved user profile + ingested CV + saved jobs to suggest missing CV keywords, summary angle, and experience emphasis.

## Product Read Refinement

The correct mental model is:

- `job` is a decision engine + reusable work object
- not a CRM record
- not a parser dump
- not only a launch pad for one proposal

If the object is good enough, it improves:

- activation through better handoff
- trust through normalization and editability
- action speed through clearer recommendations
- retention through linked artifacts
- future monetization through retargeting and higher-value reuse

## Open Questions

- Whether summary/skills alignment should update the CV automatically or only suggest diffs.
- Whether the base user profile should be canonicalized separately from the active CV.
- Whether job normalization should stay heuristic or move to a stricter LLM-backed extraction contract with recovery UI.

## Recommendation

Do not position the current jobs page as a polished job workspace yet.

Use it as the foundation for:

- a trustworthy normalized brief
- a fast decision engine
- better quick-start activation
- stronger resume/proposal retargeting
- durable repeat usage anchored on saved jobs
