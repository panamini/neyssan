# Structured Match 100-Case Internal Review

## Decision

Start collecting the next 100 internal review cases for structured match shadow output.

Do not tune the structured scorer during collection. Tuning is allowed only after fresh review data from the current scorer version shows a blocker or recurring calibration failure.

Production `computeMatchRead` remains authoritative. Structured match remains shadow-only.

## Baseline

The 30-case beta readout after blocker fixes is the baseline for starting this phase:

- reviewed cases: 30
- coverage: complete across required categories
- rollout gate: ready
- false strong: none
- overconfident partial: none
- blocker labels: none
- remaining issues: calibration follow-ups only

The old beta JSONL may be used as historical context only. Go/no-go decisions for this phase require review records regenerated or collected from the current structured scorer version.

## Collection Target

Collect 100 additional internal review cases.

Suggested sampling quota:

- security/licensed: 12
- retail/service: 12
- admin/office: 12
- technical: 12
- healthcare/regulated: 12
- multilingual: 10
- short noisy scrape: 10
- long duplicated scrape: 10
- negative controls: 10

## Versioning Requirement

Each review record must include:

- app git commit SHA
- structured scorer code commit or version
- extraction model
- extraction prompt version
- review timestamp

A review record is invalid for rollout decisions if it cannot be tied to the current structured scorer version.

The logging mutation rejects records when no app git commit SHA can be resolved from `STRUCTURED_MATCH_REVIEW_APP_GIT_COMMIT_SHA`, `APP_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, `GIT_COMMIT_SHA`, or `VITE_GIT_COMMIT_SHA`.

Each reviewed job/profile pair should log:

- reviewer id/email
- job id
- profile id or resume id
- production score/tier
- structured score/tier
- matched, partial, missing, and unknown counts
- metadata leak count
- hard-gate missing count
- language preserved
- provenance complete
- reviewer label
- optional notes

## Allowed Labels

- good
- acceptable but conservative
- false weak
- false strong
- overmatched
- undermatched
- evidence missing
- language issue
- metadata leak
- hard-gate issue

## Stop Rules

Pause ramp-up and review before any scorer tuning if fresh data shows:

- any `false strong`
- any blocker label: `overmatched`, `metadata leak`, `language issue`, or `hard-gate issue`
- negative controls not remaining `weak`
- a `strong` tier with fewer than 2 meaningful matched evidence items
- a `strong` tier with high unknown pressure
- recurring metadata or language failures
- production score/tier changing during shadow review

## Go/No-Go Gate

Broader rollout remains blocked until the fresh 100-case readout says `Rollout gate: ready` and confirms:

- no `false strong`
- no blocker labels
- negative controls remain `weak`
- strong tiers have at least 2 meaningful matched evidence items
- no strong tier with high unknown pressure
- no recurring metadata or language failures
- production score remains unchanged

## Operating Boundary

This phase must not change:

- `computeMatchRead`
- production score or tier
- ranking
- filtering
- badges
- CTA copy
- Proposal Forge
- extraction schema
- model selection
- prompt version
- structured scorer formula
- normal user Jobs UI

## Rollback

Rollback remains flag-only:

- turn off `STRUCTURED_MATCH_READ_INTERNAL_UI`
- turn off `STRUCTURED_MATCH_READ_SHADOW`
- remove or empty internal reviewer allowlists

Production score/tier and normal UI remain unaffected.

## Readout Commands

Summarize fresh records:

```bash
rtk ./node_modules/.bin/tsx scripts/evals/summarize-structured-match-review.ts ../docs/audits/structured-match-review/<fresh-100-case-review>.jsonl
```

Regenerate from current scorer before using a JSONL readout for a rollout decision:

```bash
rtk ./node_modules/.bin/tsx scripts/evals/regenerate-structured-match-review.ts ../docs/audits/structured-match-review/<fresh-100-case-review>.jsonl ../docs/audits/structured-match-review/<fresh-100-case-review-regenerated>.jsonl
```

## Current Execution Note

Local browser collection requires a working Convex target. The last local audit found `VITE_CONVEX_URL=http://127.0.0.1:3210` and local Convex blocked by system-volume `ENOSPC`, not by missing `jobsPublic:listForUser` or `jobsPublic:markOpened` exports. Collection can proceed against a working Convex target, or after freeing enough space for local Convex to start.

## Flag Lifecycle

- owner: Jobs / Structured Match owner
- review date: after 100-case internal readout
- cleanup/review ticket must be created when enabling the internal UI flag
- removal condition: remove or rename beta flags once structured scoring either graduates, is paused, or is replaced by a new rollout flag
