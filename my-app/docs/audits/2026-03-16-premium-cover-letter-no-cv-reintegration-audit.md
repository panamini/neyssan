# Premium Cover Letter No-CV Reintegration Audit

Date: 2026-03-16

## Scope

- premium `cover_letter` only
- `gpt-5.4` premium writer path
- no-CV flow only
- smallest safe reintegration inside the premium architecture

## Findings

### Active code

- Proposal Forge already sends `personalizationMode: "explicit_only"` from the app payload builder, so true no-CV requests can arrive at the backend without silently merging fallback profile data.
- The current premium blocker lived inside `convex/lib/proposals/premiumCoverLetter.ts`, not in app request shaping.
- Premium eligibility rejected no-CV requests because `evaluatePremiumCoverLetterEligibility(...)` returned `missing_cv`.
- Premium context classification returned `null` whenever no CV facts existed.
- Evidence ranking only promoted CV facts into `strongestEvidence` and `supportingEvidence`, so no-CV could never produce a usable premium brief.
- The premium repair fallback also assumed "this background" existed, which would have been false for no-CV.

### Legacy but informative code

- The older no-context cover-letter behavior still exists in the legacy Mistral-oriented path and proposal enforcement layer.
- That legacy code was useful as a policy reference for no-context honesty rules, especially around blocking unsupported past-experience phrasing.
- It was not used as the reintegration path.

## Classification

- `premium no-CV eligibility issue`
- `premium evidence-ranking assumption issue`
- `premium no-CV honesty-guard gap`

## Implementation

- Added a narrow premium-only context variant: `no_cv`.
- Re-enabled premium eligibility for no-CV when the job offer contains enough concrete work content to build a safe brief.
- Reused the existing job-offer extraction and prioritization layer to populate no-CV `topEvidence` and `supportEvidence` from employer-side work surfaces rather than candidate history.
- Added a no-CV-specific premium prompt contract so the writer is told explicitly that:
  - there is no supported candidate history
  - employer-side work surfaces must be treated as employer priorities, not past experience
  - prior roles, achievements, credentials, tool usage, and day-one readiness claims are not allowed
- Added one premium-local non-repairable validation rule for invented past-experience phrasing in no-CV mode.
- Updated the premium repair fallback sentence so it no longer references "this background" when no CV exists.

## Files

- `convex/lib/proposals/premiumCoverLetter.ts`
- `convex/lib/proposals/__tests__/premiumCoverLetter.test.ts`

## Validation

- Ran `npm test -- premiumCoverLetter.test.ts`
- Result: 19/19 tests passed

## Recommendation

- Keep this change.
- It restores no-CV `cover_letter` generation on the premium ChatGPT path without reviving the legacy Mistral path as the main solution.
- If later no-CV quality still feels too thin, the next step should stay inside the premium brief/prompt layer, not routing.
