# Premium Cover Letter Job-Offer Prioritization Audit

Date: 2026-03-16

## Scope

- Active path only: premium `cover_letter`
- Writer baseline fixed: `gpt-5.4`
- Focus: job-offer extraction, prioritization, compression, and brief usage

## Evidence Classification

- Active code
  - `my-app/convex/lib/proposals/premiumCoverLetter.ts`
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/__tests__/premiumCoverLetter.test.ts`
- Active benchmark-style evidence
  - `my-app/scripts/evals/cases/cover-letter/cases.ts`
  - `my-app/benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json`
- Legacy but informative
  - `my-app/docs/plans/2026-03-15-cover-letter-selector-extractor-next-step-plan.md`
  - `my-app/docs/audits/2026-03-15-cover-letter-quality-failclosed-audit.md`
  - These remain informative for adjacent output-failure shape, but they are not the authority for the current premium path.

## Findings

### 1. Before this patch, premium job-offer understanding was too flat

The premium branch already ranked CV evidence reasonably well, but its job-offer understanding was materially weaker:

- it extracted raw `job_post` snippets
- it built `workContext` from the first operational clauses it could find
- it did not explicitly separate:
  - core responsibilities
  - must-have qualifications
  - preferred or secondary qualifications
  - low-value checklist items
  - company-description or benefits fluff

In practice, that meant the writer brief had strong CV-side hierarchy and weak employer-side hierarchy.

### 2. `workContext` was the main compression bottleneck

Before the change, the premium brief carried employer-side context mostly as `workContext?: string[]`, built from clause snippets. That created three problems:

- it was flat rather than hierarchical
- it could clip responsibilities into fragments like `service intake.`
- it depended too much on clause order rather than employer priority

That is not how a strong human candidate reads a posting.

### 3. Offer weighting could overvalue optional overlap

Before the change, premium context classification and evidence scoring used a flat token bag from the full job title and raw job description.

Observed active-case failure shape:

- backend-heavy full-stack posting
- candidate with frontend background and light API exposure
- optional React overlap could still push the case toward `cv_direct`

That means the system was not reliably distinguishing:

- real must-haves
- adjacent but optional overlap
- requirement-listing noise

### 4. The premium prompt was trying to compensate for missing offer structure

The prompt already told the writer to avoid checklist repetition and generic employer-value language. That helped, but the brief still did not supply a good enough employer-side priority map. The remaining quality risk was therefore upstream in offer interpretation/compression, not mainly a prompt-tone problem.

## Implemented Change

Added one narrow premium-layer helper in `premiumCoverLetter.ts`:

- `buildJobOfferPriorityPack(jobDescription)`

It now derives:

- `coreResponsibilities`
- `keyRequirements`
- `preferredQualifications`
- `lowValueChecklist`
- `companyFluff`
- `priorityTokens`

That helper is now reused in the same premium layer for:

- context classification
- CV fact ranking against the offer
- brief construction for the premium writer

The premium brief now carries a more human-like hierarchy:

- `topResponsibilities`
- `keyRequirements`
- `preferredQualifications`
- `lowValueChecklist`
- `workContext` as a compact responsibility-facing subset instead of the old first-match clause list

## Why This Is The Smallest Useful Fix

- no architecture change
- no routing change
- no provider change
- no validator redesign
- no broad prompt rewrite

This stays in the premium cover-letter layer and fixes the specific missing capability: employer-side prioritization.

## Resulting Assessment

### Extraction

Now adequate for the premium path's current scope.

### Prioritization

Previously not adequate.

After this patch, materially improved:

- responsibilities are separated from qualifications
- must-have signals are separated from preferred signals
- low-value checklist items are explicitly demoted
- optional overlap is less likely to drive direct-match classification

### Brief Usage

Now better aligned with the human-quality standard because the writer receives employer-side hierarchy instead of mostly flat snippets.

## Residual Risks

- The helper is still heuristic and English-biased.
- Some mixed sentences can still compress awkwardly when the source posting is heavily list-shaped.
- `companyFluff` is only lightly used today; it is mainly excluded rather than actively surfaced as a negative signal.
- The premium branch still does not perform deep semantic understanding of employer priorities beyond lightweight extraction.

## Recommendation

Keep this premium-layer offer-priority helper.

Do not broaden the change unless fresh premium-output review still shows letters drifting after this richer brief. If another issue remains, the next smallest follow-up should stay in the same layer and tighten the helper rather than introducing a new planning stage.
