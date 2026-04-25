# Structured Match Internal Beta Review

## Decision

Proceed to internal beta review of structured shadow output.

Do not proceed to production rollout or user-facing promotion.

Production score remains authoritative. Structured match output remains shadow-only until the review set and calibration readout are complete.

## Implemented Boundary

This pass adds review/readout mechanics only:

- typed review categories and labels
- per-case review record shape
- calibration readout aggregation
- blocker label counting
- example buckets for calibration review
- rollout gate status and reasons
- CLI readout generation from JSON or JSONL review records

This pass does not change:

- `computeMatchRead`
- production score or tier
- visible match output
- structured shadow scoring formula
- extraction schema validation
- user-facing promotion or rollout state

## Review Scope

Review 30-50 real job/profile pairs before broader rollout.

Required coverage:

- security/licensed
- retail/service
- admin/office
- technical
- healthcare/regulated
- multilingual
- short noisy scrape
- long duplicated scrape
- negative controls

The next data pass should focus on semantic correctness and tier calibration, not schema validity. Schema validity is guarded upstream by Mistral `json_schema` and still enforced by the app-level `NormalizedJobExtractionSchema`.

## Per-Case Rubric

For each job/profile pair, review structured shadow output only.

### 1. Extraction Quality

- Are summary, requirements, and keywords semantically correct?
- Are metadata, company boilerplate, benefits, compensation, and location kept out of requirements?
- Is language preserved?

### 2. Evidence Quality

- Do matched and partial outcomes cite real profile evidence?
- Are certifications, licenses, education, skills, experience, projects, and languages used correctly?
- Is `raw_text` only weak fallback evidence?

### 3. Outcome Quality

- Are matched items truly matched?
- Are partial items reasonable?
- Are unknown items really unknown rather than missing?
- Are missing items real gaps, not absent evidence?

### 4. Tier Calibration

- Does strong feel too generous?
- Does partial feel too conservative?
- Does weak catch true weak fits?
- Does a high unknown count make the score feel overconfident?

## Failure Labels

Mark each case with one or more labels:

- good
- acceptable but conservative
- overmatched
- undermatched
- metadata leak
- evidence missing
- language issue
- hard-gate issue

Treat `acceptable but conservative` as passable for internal beta.

Treat these as blockers for broader rollout:

- overmatched
- metadata leak
- language issue
- hard-gate issue

Treat `undermatched` and `evidence missing` as calibration or data follow-ups unless they are frequent.

## Readout

The calibration readout summarizes:

- number of reviewed cases
- coverage by fixture category
- label counts
- examples of false strong, false weak, and overconfident partial outcomes
- examples where extraction was correct but evidence matching failed
- examples where evidence was correct but tier calibration felt wrong
- recommended next action:
  - add fixtures
  - tune extraction semantics
  - tune evidence matching
  - tune tier gates
  - hold rollout

## Rollout Gate

Broader rollout requires:

- at least 30 reviewed real job/profile pairs
- coverage across all required categories
- no recurring metadata leak or language preservation failures
- negative controls remain weak
- strong tiers have meaningful matched evidence coverage
- high unknown counts do not produce overconfident scores
- production score remains unchanged unless a separate rollout decision is made

## Implementation

- `my-app/convex/lib/jobs/structuredMatchReview.ts`
- `my-app/convex/lib/jobs/__tests__/structuredMatchReview.test.ts`
- `my-app/scripts/evals/summarize-structured-match-review.ts`

Run the focused verification:

```bash
rtk ./node_modules/.bin/vitest --run convex/lib/jobs/__tests__/structuredMatchReview.test.ts convex/lib/jobs/__tests__/structuredMatchRead.test.ts convex/lib/jobs/__tests__/structuredMatchReadEvaluation.test.ts
```

