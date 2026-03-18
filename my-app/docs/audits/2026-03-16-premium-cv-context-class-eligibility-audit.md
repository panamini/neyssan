# Premium CV Context Class Eligibility Audit

Date: 2026-03-16

## Scope

- premium `cover_letter` only
- CV-backed cases only
- ChatGPT / premium eligibility
- context-class inference

## Findings

- Active code: `unsupported_context_class` was coming from `inferPremiumCoverLetterContextClass(...)` returning `null`, not from a stale supported-class allowlist.
- Active code: the premium path only supports `cv_direct`, `cv_adjacent`, and `no_cv`, and the allowlist itself was consistent with current product intent.
- Active code: the CV-backed classifier depended on exact lexical overlap between normalized CV/job tokens.
- The weak point was token normalization, not premium routing:
  - `manage` vs `managed`
  - `documented` / `documentation`
  - `coordinate` / `coordinator` / `coordination`
  - similar workflow/admin morphology drift
- That meant some realistic CV-backed admin/ops/support matches could produce enough grounded evidence for a useful premium adjacent letter, but still be rejected before ranking because overlap stayed below the `cv_adjacent` threshold.
- This was too strict for current product intent. Honest adjacent CV-backed cases are already supported by the premium prompt and validator contract, so excluding them at this lexical boundary was contract drift.

## Narrow fix

- Keep the premium context classes unchanged.
- Keep eligibility flow unchanged.
- Add lightweight token canonicalization inside `normalizeTokens(...)` so common workflow/admin morphology variants map to the same overlap signal.

## Validation

- `npm test -- premiumCoverLetter.test.ts`
- Added a focused regression for a CV-backed `Office Administrator` case that previously failed due to morphology drift and now resolves to `cv_adjacent` with premium eligibility.
