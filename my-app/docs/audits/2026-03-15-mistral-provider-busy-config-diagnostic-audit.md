# Mistral Provider Busy Config Diagnostic Audit

Date: 2026-03-15

## Scope

- Investigate recurring `proposal_generation_provider_busy` failures, especially at `legacy_generation`.
- Limit this pass to code/config/logging diagnostics.
- Do not change routing, fallback, retries, or proposal-generation product behavior.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/src/components/ProposalInputForm.tsx`
  - `clerk-chrome-extension-final/src/background/index.ts`
  - `save_chrome_ext/background.ts`
  - `my-app/scripts/evals/run-proposal-model-benchmark.ts`
  - `my-app/benchmarks/proposal-generation/adapters/mistral.ts`
- Runtime evidence captured in repo docs
  - `my-app/docs/audits/2026-03-15-provider-busy-live-outage-audit.md`
  - `my-app/docs/audits/2026-03-15-provider-busy-post-bypass-audit.md`
- Legacy but informative
  - `my-app/env.md`
- Uncertainty
  - cannot verify Mistral org/workspace billing, quota, or dashboard state from code alone
  - cannot identify the real workspace behind the current runtime key from code alone

## Findings

### 1. The runtime key source is simple, but the repo does not prove which workspace/org it belongs to

- Active proposal generation reads `process.env.MISTRAL_API_KEY` directly in Convex before any Mistral call.
- There is no per-request override, tenant-specific key selection, or environment indirection in the active proposal path.
- Missing-key behavior would produce a configuration error, not `provider_busy`.

Relevant active code:

- `my-app/convex/generateProposalMutation.ts`
  - reads `process.env.MISTRAL_API_KEY` for chat models
  - reads `process.env.MISTRAL_AGENT_ID` only for `mistral-agent`
- `my-app/convex/config/env.ts`
  - declares `MISTRAL_API_KEY` and `MISTRAL_AGENT_ID` as optional env vars

Implication:

- a wrong-but-valid key or a key from the wrong Mistral workspace remains possible
- code alone cannot distinguish that from a real quota/rate-limit problem

### 2. The default active model is `mistral-small-latest`

- The web UI defaults to `mistral-small-latest`.
- The extension background handlers also default to `mistral-small-latest`.
- The active chat path for both `mistral-small-latest` and `mistral-large-latest` shares the same rate-limit classification logic.

Implication:

- model-specific throttling remains possible
- no model aliasing or accidental model-name typo is visible in the active path

### 3. A single submission can fan out into several Mistral calls even without retries

Per request, active code can trigger:

- planner parse: 1 Mistral call
- planner JSON fallback: +1 only on non-429 parse failure
- structured content-plan parse: +1
- structured content-plan JSON fallback: +1 only on non-429 parse failure
- structured body generation: up to 4 calls
- structured repair: additional repair calls, including regeneration
- legacy generation: 1 call
- legacy repair-by-sentence: up to one call per flagged sentence when local repair is insufficient

Important nuance:

- confirmed 429/provider-busy is fail-fast at the stage where it occurs
- there is no retry after confirmed provider-busy
- however, before a busy condition occurs, the normal success/fallback path can still consume multiple Mistral requests for one user submission

Implication:

- app-side burst pressure from ordinary submissions is plausible, especially during CV-backed cover-letter flows
- this risk exists even without explicit retry logic

### 4. The frontend web form does not obviously duplicate the action call

- `ProposalInputForm.tsx` short-circuits if `isGenerating` is already true.
- The client updates the generated proposal after the action returns, but does not call generation again.
- The extension paths each issue one backend action call per explicit generate event.

Implication:

- obvious duplicate-submit behavior is not visible in the main web form path
- repeated user testing across browser/app/extension or benchmark runs remains possible, but the primary burst risk is more likely on the backend call graph than accidental double-submit inside the form

### 5. Current telemetry is good at stage attribution but not root-cause attribution

Current logs can distinguish:

- which stage failed: `planner_parse`, `legacy_generation`, `structured_body_generation`, etc.
- whether the request was structured-eligible
- whether a controlled fallback to ChatGPT was attempted
- whether a `retryAfterMs` value was extracted into the controlled Convex error payload

Current logs cannot distinguish:

- workspace/org quota exhaustion vs low request-per-minute cap
- wrong workspace/key with valid authentication vs correct workspace under quota pressure
- one noisy caller vs many concurrent callers
- whether failures cluster by model, by user, or by path
- the upstream Mistral request identifier or raw provider error code/message

## Minimal Diagnostic Logging Additions

Smallest additions that would materially improve diagnosis:

1. On every caught Mistral provider-busy or transport error, log one structured event with:
   - `stage`
   - `requestedModelType`
   - `actualModelType`
   - `outputFormat`
   - `hasCv`
   - `structuredEligible`
   - `retryAfterMs`
   - `statusCode`
   - provider error `code`/`type` if present
   - provider message snippet if present
   - any upstream request id header if present

2. Add a per-request `mistralCallCount` accumulator in `generateProposalMutation.ts`, incremented at each Mistral callsite, and log it once at success/failure.

3. Add a coarse request fingerprint to the same log:
   - Convex request id if available
   - user id
   - path label (`planner`, `structured`, `legacy`, `repair`)
   - a generated submission id shared across all Mistral callsites for that action execution

4. Add one redacted startup/config log for proposal generation environment:
   - key presence only
   - key suffix hash or last 4 chars only
   - rollout mode
   - whether model came from request or default

These are observability-only changes and do not require routing or retry changes.

## Immediate Manual Checks In Mistral Console

1. Confirm the exact API key used by Convex and which Mistral workspace/org owns it.
2. Verify billing is active for that workspace and not pending activation/suspension.
3. Check request-per-minute / token-per-minute limits for the workspace and for `mistral-small-latest`.
4. Check recent usage graphs around the failing windows for short spikes rather than steady burn.
5. Inspect recent request logs for:
   - HTTP 429 frequency
   - any `Retry-After`
   - request ids
   - model-specific concentration
6. Confirm whether the key is scoped or rotated, and whether another app or script is using the same key.
7. If console supports it, compare failures by model to see whether `mistral-small-latest` is disproportionately throttled.

## Bottom Line

Most likely causes visible from code are:

1. app-level burst/concurrency pressure amplified by a multi-call-per-submission Mistral path
2. low workspace/org rate limits or temporary provider throttling
3. wrong workspace/key with a valid key that authenticates but belongs to a constrained or unintended account

Billing activation state, exact quota exhaustion, and workspace mismatch cannot be resolved from code alone with current logging.
