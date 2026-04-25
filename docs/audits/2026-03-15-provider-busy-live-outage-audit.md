# Provider Busy Live Outage Audit

Date: 2026-03-15

## Scope

- Audit the pasted Convex logs from approximately 4:33 PM on 2026-03-15.
- Determine whether the new provider-busy telemetry is now internally consistent.
- Explain what the logs mean operationally for both CV-backed and no-CV cover-letter generation.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
- Runtime evidence
  - pasted Convex action logs from `functions:generateProposal`
- Uncertainty
  - the logs confirm a Mistral rate-limit failure at the planner stage
  - the logs do not identify the upstream cause of that 429 burst:
    - account quota exhaustion
    - provider-side temporary throttling
    - local burst pressure from repeated testing

## Findings

### 1. The telemetry is now consistent

Observed behavior:

- no-CV requests show:
  - `structuredEligible: false`
  - `structuredEligibilityReason: context_gate:missing_candidate_context`
  - `runtimeFailureReason: runtime_failure:provider_busy`
  - `attemptedPath: planner-only path before legacy generation`
  - `failureStage: planner_parse`
- CV-backed requests show:
  - `structuredEligible: true`
  - `structuredEligibilityReason: eligible`
  - `runtimeFailureReason: runtime_failure:provider_busy`
  - `attemptedPath: planner-only path before structured generation`
  - `failureStage: planner_parse`

Interpretation:

- the previous field-overload issue is fixed
- the previous `attemptedPath` ambiguity is also fixed
- the telemetry now answers four different questions cleanly:
  - was structured eligible?
  - why was it or was it not eligible?
  - why did the request terminate?
  - what actually ran before termination?

Conclusion:

- the current logs are internally coherent

### 2. The failure is happening before either structured generation or legacy generation

Observed behavior:

- every request ends at `failureStage: planner_parse`
- both no-CV and CV-backed requests fail before any later stage appears

Interpretation:

- the first Mistral dependency in the Mistral proposal path is still the planner call
- that planner call is shared infrastructure for:
  - structured CV-backed generation
  - no-CV legacy-oriented generation
- once that first planner call is rate-limited, the request ends immediately by design

Conclusion:

- the current outage is upstream of the structured-vs-legacy split

### 3. This is no longer a telemetry bug or a fail-fast bug

Observed behavior:

- the thrown error is the controlled provider-busy `ConvexError`
- `stage: planner_parse` is preserved in both telemetry and the error payload
- no later invoke is visible

Interpretation:

- the code is now doing the right thing for provider 429
- the system is failing honestly and early
- the same failure appearing across presets is expected, because the blocker is the shared planner call, not tone-specific logic

Conclusion:

- repeated failures across both CV and no-CV do not indicate a new regression in routing
- they indicate that Mistral availability is currently the active bottleneck

### 4. Product availability is currently the real blocker

Observed behavior:

- all tested Mistral cover-letter requests fail
- this includes:
  - no-CV requests that would otherwise continue on legacy generation
  - CV-backed requests that would otherwise continue on the structured path

Interpretation:

- proposal-quality iteration on the Mistral path cannot progress while the planner call is provider-busy
- further repeated sweeps against the same provider are unlikely to produce new quality evidence until availability improves

Conclusion:

- the next issue to solve is availability strategy, not more telemetry cleanup

## Verdict

The new logs show a correct system under an active upstream provider bottleneck.

What is confirmed:

- telemetry fields are now semantically correct
- provider-busy fail-fast remains correct
- `failureStage` is now truthful
- `attemptedPath` is now truthful
- both CV-backed and no-CV failures are explained by the same shared planner-stage 429

What the logs do not prove:

- why Mistral is rate-limiting right now
- whether this is a temporary burst or a sustained availability problem

## Recommended Next Step

The best next step is to stop treating this as a routing bug and move to an availability-oriented continuation plan:

1. verify the upstream cause of the Mistral 429s
2. stop repeated same-provider sweeps while the provider is busy
3. continue proposal-quality work on a non-blocked path
4. separately decide whether product availability needs a planner-dependency mitigation or a provider-routing mitigation
