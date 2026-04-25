# Provider Busy Continuation Plan

Date: 2026-03-15

## Scope

- Define the smallest practical next steps after the provider-busy telemetry cleanup.
- Separate immediate operational continuation from larger product-availability decisions.
- Avoid treating a provider outage as a proposal-quality bug.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
- Runtime evidence
  - 4:33 PM Convex logs showing provider-busy failures at `planner_parse` for both CV-backed and no-CV requests
- Uncertainty
  - unknown whether the current Mistral 429s are caused by quota, provider-side throttling, or local burst pressure

## Current Reality

The system is now behaving correctly:

- provider 429 is fail-fast
- telemetry is truthful
- no raw SDK errors escape
- no extra Mistral calls occur after a confirmed busy failure

The current blocker is availability:

- both CV-backed and no-CV Mistral cover-letter requests depend on the planner call
- the planner call is currently the first Mistral dependency
- a planner-stage 429 therefore blocks both paths before useful output generation begins

## Best Next Steps

### Immediate

1. Stop repeated Mistral quality sweeps while the provider is actively returning `planner_parse` 429s.
2. Verify the upstream cause outside the proposal pipeline:
   - check Mistral quota and rate-limit dashboard state
   - inspect whether request volume spikes align with the failing window
   - confirm whether `retryAfter` is available in raw provider responses
3. Continue product and quality work on an unblocked path:
   - use the ChatGPT path for proposal-quality comparison work
   - use `DEV_STUB=true` only for UI or interaction-state testing

### Next

4. Decide whether the product needs a real availability mitigation, not just better logging.
5. If yes, choose one explicit mitigation track instead of mixing several partial ones:
   - planner dependency mitigation
   - queued retry / deferred execution
   - cross-provider routing / fallback

### After That

6. Implement only one mitigation at a time behind a narrow flag and measure its effect.
7. Re-run live CV-backed and no-CV audits only after the provider is available again or an availability mitigation is intentionally shipped.

## Recommended Decision Order

### Option A. Ops-first continuation

Use this if the current provider-busy period looks temporary.

What to do:

1. verify quota / throttling state
2. pause repeated Mistral tests
3. continue quality work on ChatGPT or fixture-based evaluation
4. resume Mistral audits when availability returns

Why this is the smallest next move:

- no product behavior changes
- no new routing complexity
- avoids building outage workarounds for a short-lived provider event

### Option B. Availability-first product follow-up

Use this only if Mistral planner-stage 429 becomes a recurring product problem.

Smallest serious decisions to consider:

1. no-CV planner-dependency mitigation
   - deliberate behavior change
   - only worth doing if no-CV availability matters independently
2. cross-provider fallback
   - broader product behavior change
   - must be explicit, not accidental
3. queued retry / async generation
   - changes request semantics and UX expectations

Why this should be explicit:

- each option changes product behavior
- each option changes evaluation meaning
- none of them is a pure bug fix

## Recommended Path

The best path to continue right now is Option A.

Reason:

- the current logs show correct fail-fast behavior, not a broken routing system
- the team can keep making progress on proposal quality without forcing more Mistral requests during an active 429 window
- availability mitigation should be a conscious product decision if the issue persists, not an emergency patch hidden inside telemetry work

## Decision

Proceed in this order:

1. verify whether the Mistral 429 burst is temporary or recurring
2. pause repeated Mistral output sweeps during active provider-busy windows
3. continue proposal-quality iteration on ChatGPT or fixture-based evidence
4. only if provider-busy becomes a recurring product problem, scope one explicit availability mitigation as a separate task
