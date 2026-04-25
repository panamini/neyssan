# Provider Busy Log Audit

Date: 2026-03-15

## Scope

- Audit the pasted Convex logs for the new Mistral provider-busy fail-fast path.
- Determine whether the observed `planner_parse` busy failures match active code.
- Call out any remaining telemetry or routing ambiguities.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
- Runtime evidence
  - pasted Convex action logs from `functions:generateProposal`
- Uncertainty
  - none on the control-flow interpretation; the logs line up with the active code path

## Findings

### 1. The provider-busy fail-fast path is working as implemented

Observed behavior:

- every pasted request ends with one controlled `ConvexError`
- the error payload is the new internal shape:
  - `code: proposal_generation_provider_busy`
  - `provider: mistral`
  - `stage: planner_parse`
- no raw `SDKError` escapes the action
- no later generation stage appears after the first confirmed 429

This matches the current implementation:

- the first Mistral call for the standard Mistral proposal path is still the planner parse call in `buildStructuredProposalPlan(...)`
- on a confirmed 429, that function throws `ProposalProviderBusyError` immediately instead of attempting JSON retry
- `handleGenerateProposal(...)` converts that internal error into the controlled `ConvexError`

Relevant active code:

- planner 429 classification and immediate throw:
  - `my-app/convex/generateProposalMutation.ts:1108`
- controlled provider-busy conversion:
  - `my-app/convex/generateProposalMutation.ts:617`
  - `my-app/convex/generateProposalMutation.ts:6235`

Conclusion:

- the pasted logs do not show a regression against the intended fail-fast contract

### 2. `planner_parse` on no-CV requests is expected in the current architecture

This is the main point that can look surprising in the logs.

Observed behavior:

- even no-CV requests show:
  - `structuredEligible: false`
  - `counterfactualNextStructuredGate: missing_candidate_context`
  - error stage `planner_parse`

Why this happens:

- `handleGenerateProposal(...)` still runs the planner before it decides whether the request can use the structured cover-letter path
- that planner result is shared infrastructure for both:
  - structured cover-letter generation when eligible
  - legacy prompt enrichment / verification when not eligible

So for no-CV requests:

- the request is not structured-eligible
- but it still reaches the planner call first
- if that first provider call is rate-limited, the request now fails immediately by design

Relevant active code:

- planner call happens before structured/legacy split:
  - `my-app/convex/generateProposalMutation.ts:5819`

Conclusion:

- `stage: planner_parse` on no-CV requests is expected, not evidence that structured no-CV behavior broadened

### 3. The only real issue is a telemetry-labeling ambiguity

Observed behavior:

- for no-CV requests, logs now show:
  - `structuredEligible: false`
  - `structuredRejectedReason: runtime_failure:provider_busy`
  - `counterfactualNextStructuredGate: missing_candidate_context`

Interpretation:

- this is semantically mixed
- the request was ineligible for structured generation because candidate context was missing
- but the `structuredRejectedReason` field no longer shows that ineligibility reason once provider busy occurs

Why:

- `getStructuredRejectedReason(...)` now prioritizes `provider_busy` ahead of the usual structured eligibility gates

Relevant active code:

- `my-app/convex/generateProposalMutation.ts:1458`

Impact:

- product behavior is fine
- telemetry is slightly less precise for no-CV requests because one field now answers "why the request ended" instead of "why structured routing was rejected"

Severity:

- low
- observability-only

### 4. `Uncaught ConvexError` in Convex logs is expected here

Observed behavior:

- Convex prints `Uncaught ConvexError: {...controlled payload...}`

Interpretation:

- this is not the old failure mode
- the old bug was raw provider/SDK errors escaping
- now the action is intentionally throwing a controlled `ConvexError` to the client boundary

Conclusion:

- this log wording is compatible with a controlled failure path
- the important check is that the thrown value is the controlled provider-busy error, not a raw SDK error

## Verdict

The pasted logs are mostly correct and consistent with the intended implementation.

What is confirmed:

- provider 429 now fails fast
- no JSON retry occurs after confirmed planner 429
- no legacy Mistral invoke occurs after the confirmed planner 429
- no raw `SDKError` escapes the action
- no-CV behavior was not broadened

What remains imperfect:

- `structuredRejectedReason` is now overloaded for no-CV requests and hides the underlying `missing_candidate_context` gate once provider busy occurs

## Recommended Next Step

Small, optional telemetry-only cleanup:

1. keep provider-busy as the runtime failure signal
2. preserve the original structured eligibility rejection in telemetry for ineligible requests

Smallest way to do that:

- for ineligible requests, keep `structuredRejectedReason` as `context_gate:missing_candidate_context` or the relevant eligibility gate
- if provider busy also occurs, represent that separately through an existing runtime-oriented field or a narrowly added telemetry field

This is not required for correctness.
It is only worth doing if the current logs are causing routing interpretation confusion during audits.
