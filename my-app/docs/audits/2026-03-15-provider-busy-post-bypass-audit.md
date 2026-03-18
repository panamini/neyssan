# Provider Busy Post-Bypass Audit

Date: 2026-03-15

## Scope

- Audit the latest live logs after the no-CV planner-bypass change and the frontend catch-path fix.
- Correct the interpretation of current CV-backed vs no-CV failures.
- Identify whether the active blocker is still backend control flow or has shifted elsewhere.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/src/components/ProposalInputForm.tsx`
  - `my-app/src/lib/proposal-generation-ui.ts`
- Runtime evidence
  - 5:36 PM Convex logs pasted by the user
- Uncertainty
  - the user reports a no-CV "pending" symptom, but the pasted backend logs show the no-CV request did terminate with a controlled failure
  - if the UI still looks unresolved, that symptom is now downstream of backend generation control flow

## Findings

### 1. CV-backed requests are still blocked at the planner

Observed behavior:

- CV-backed requests still log:
  - `structuredEligible: true`
  - `attemptedPath: planner-only path before structured generation`
  - `failureStage: planner_parse`
  - controlled provider-busy `ConvexError`

Interpretation:

- this remains the same provider-availability blocker already identified earlier
- CV-backed Mistral cover-letter generation is still stopped by planner-stage 429s

Conclusion:

- the CV-backed blocker is still provider availability on the shared planner call

### 2. The no-CV planner bypass is active and working

Observed behavior:

- the no-CV request now logs:
  - `structuredEligible: false`
  - `structuredEligibilityReason: context_gate:missing_candidate_context`
  - `attemptedPath: legacy-only path`
  - `failureStage: legacy_generation`
  - controlled provider-busy `ConvexError`

Interpretation:

- this is no longer a planner-stage failure
- the request bypassed the planner and reached the legacy Mistral generation step before hitting provider busy

Conclusion:

- the no-CV planner-dependency mitigation is active
- the no-CV path is no longer blocked at `planner_parse`

### 3. The no-CV backend request is not hanging

Observed behavior:

- the backend emitted routing telemetry
- the backend threw one controlled provider-busy `ConvexError`
- the failure stage is explicitly `legacy_generation`

Interpretation:

- from the backend perspective, the request completed with a controlled failure
- this is not a backend hang and not a silent backend no-op

Conclusion:

- if the user still sees "pending" or "no error" in the UI, that is no longer explained by backend generation control flow

### 4. The likely remaining gap is now frontend presentation/state, not provider routing

Relevant active code:

- `ProposalInputForm.tsx` now catches errors, maps the friendly busy message, and clears `isGenerating` in `finally`
- the error message is rendered inline at the bottom of the form

Interpretation:

- the prior `ReferenceError` catch-path regression is fixed in active code
- if the UI still appears unresolved in live use, the likely remaining issue is one of:
  - the error is rendered but not obvious in the current viewport/layout
  - a page-level state/presentation issue outside backend generation is masking the resolved request state
  - the reported symptom came from a run before the frontend fix was actually loaded in the browser

Conclusion:

- the active interpretation should no longer treat no-CV as a planner-busy backend blocker
- the remaining no-CV symptom, if still reproducible, should be investigated as a frontend/page behavior issue

## Verdict

The latest logs split into two different realities:

- CV-backed requests are still failing for the known provider-availability reason at `planner_parse`
- no-CV requests are now correctly bypassing the planner and failing later at `legacy_generation`

That means the no-CV path is no longer showing the old backend blocker.
If no-CV still looks "pending" in the UI, the next investigation target should be frontend state/presentation, not backend routing or telemetry.
