# Provider Busy CV Repeat Audit

Date: 2026-03-15

## Scope

- Audit the latest pasted logs after the no-CV bypass and frontend visibility fix.
- Determine whether the new pasted output represents a new failure mode or the same known CV-backed provider-busy condition.
- Separate `_probeMistral` probe logs from actual `generateProposal` failures.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/actions/_probeMistral.ts`
- Runtime evidence
  - pasted Convex logs from approximately 5:47 PM to 5:48 PM on 2026-03-15
- Uncertainty
  - none on the control-flow interpretation for the pasted CV-backed requests

## Findings

### 1. This is not a new proposal-generation failure mode

Observed behavior:

- every `generateProposal` log in the pasted sample shows:
  - `structuredEligible: true`
  - `structuredEligibilityReason: eligible`
  - `runtimeFailureReason: runtime_failure:provider_busy`
  - `attemptedPath: planner-only path before structured generation`
  - `failureStage: planner_parse`
- every request ends with the same controlled provider-busy `ConvexError`

Interpretation:

- this matches the already-known CV-backed Mistral failure path
- the request is still failing on the first planner call before structured generation begins

Conclusion:

- the pasted `generateProposal` errors are the same known CV-backed provider-availability blocker, not a new regression

### 2. The `_probeMistral` logs are not the proposal-generation error

Observed behavior:

- the pasted sample also includes:
  - `[_probeMistral] CF Access headers: enabled`

Relevant active code:

- `_probeMistral.ts` logs that line when Cloudflare Access headers are configured

Interpretation:

- that line is informational
- it does not indicate a proposal-generation failure
- it only confirms the probe action is sending CF Access headers

Conclusion:

- the `_probeMistral` lines should not be treated as the root cause of the `generateProposal` failures in this sample

### 3. The sample only shows CV-backed failures

Observed behavior:

- all `generateProposal` routing telemetry entries in the pasted sample have:
  - `hasCv: true`
  - `contextMode: rich`

Interpretation:

- this sample does not contain no-CV evidence
- it therefore does not contradict the earlier result that no-CV now bypasses planner and fails later at `legacy_generation` when provider-busy occurs

Conclusion:

- this pasted sample only re-confirms the current CV-backed outage

## Verdict

The new pasted output does not show a new error class.

What it shows:

- CV-backed Mistral cover-letter requests are still blocked by provider availability at `planner_parse`
- `_probeMistral` is logging an informational CF Access status line, not a proposal failure

What it does not show:

- a no-CV regression
- a routing regression
- a telemetry regression
- a new frontend failure mode
