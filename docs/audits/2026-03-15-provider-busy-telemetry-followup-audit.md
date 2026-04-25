# Provider Busy Telemetry Follow-Up Audit

Date: 2026-03-15

## Scope

- Audit the pasted Convex logs after the telemetry cleanup that split structured eligibility from runtime failure.
- Confirm that the new log fields match active code and preserve the fail-fast behavior.
- Call out any remaining observability ambiguity without proposing routing or behavior changes.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
- Runtime evidence
  - pasted Convex action logs from `functions:generateProposal` at approximately 4:17 PM on 2026-03-15
- Uncertainty
  - low on behavior
  - low on terminology: `attemptedPath` can still be read as stronger than what actually executed during an early planner 429

## Findings

### 1. The telemetry split is now working correctly

Observed behavior:

- CV-backed requests now show:
  - `structuredEligible: true`
  - `structuredEligibilityReason: eligible`
  - `runtimeFailureReason: runtime_failure:provider_busy`
- no-CV requests now show:
  - `structuredEligible: false`
  - `structuredEligibilityReason: context_gate:missing_candidate_context`
  - `runtimeFailureReason: runtime_failure:provider_busy`

Interpretation:

- the original structured eligibility result is now preserved
- the provider-busy termination reason is now represented separately
- the previous field-overload issue is resolved

This matches active code in `buildCoverLetterRoutingTelemetry(...)`, which now computes:

- `structuredEligibilityReason` from the rollout/eligibility gate result
- `runtimeFailureReason` from the runtime fallback reason

Conclusion:

- the telemetry cleanup succeeded

### 2. `planner_parse` remains the expected failure stage for both CV-backed and no-CV requests

Observed behavior:

- every pasted request still ends with a controlled provider-busy `ConvexError`
- every pasted request still reports:
  - `stage: planner_parse`

Interpretation:

- the first Mistral call still occurs in the planner stage before later structured-vs-legacy generation decisions
- a confirmed planner 429 therefore still terminates both:
  - structured-eligible CV-backed requests
  - structured-ineligible no-CV requests

Conclusion:

- `planner_parse` is still expected here and does not imply structured-path broadening for no-CV traffic

### 3. The fail-fast behavior is still intact

Observed behavior:

- each request logs one controlled provider-busy error
- no later stage appears after the planner 429
- no raw `SDKError` is visible

Interpretation:

- the request is still ending through the controlled provider-busy error path
- there is no evidence of JSON retry after planner 429
- there is no evidence of a later legacy Mistral invoke after the confirmed rate limit

Conclusion:

- the telemetry cleanup did not regress the fail-fast contract

### 4. One low-severity wording ambiguity remains in `attemptedPath`

Observed behavior:

- structured-eligible CV-backed requests log:
  - `attemptedPath: structured fail-closed to legacy fallback`
  - `finalOutcome: not_saved`
  - controlled provider-busy error with `stage: planner_parse`

Interpretation:

- behavior is correct
- however, the `attemptedPath` label can still read as if a legacy fallback was actually attempted
- in these pasted cases, the request ended before any later legacy generation step because the planner 429 failed fast

Impact:

- low
- observability-only
- the other fields now provide enough context to interpret the event correctly

Conclusion:

- this is a naming nuance, not a behavior bug

## Verdict

The new logs are materially correct and much clearer than the previous set.

What is now confirmed:

- structured eligibility and runtime failure are separated cleanly
- no-CV requests keep `missing_candidate_context` visible
- CV-backed eligible requests keep `eligible` visible
- provider 429 still fails fast at `planner_parse`
- no raw provider error escapes the action

What remains slightly imperfect:

- `attemptedPath` can still overstate what actually executed during an early planner 429 on structured-eligible requests

## Recommended Next Step

No product or routing change is required.

Optional telemetry-only cleanup, if future audits still find this confusing:

1. keep the current field split
2. leave fail-fast behavior unchanged
3. consider renaming or refining `attemptedPath` semantics for early provider-busy terminations on structured-eligible requests

This is lower priority than the earlier `structuredRejectedReason` overload because the current logs are already interpretable without losing the key routing facts.
