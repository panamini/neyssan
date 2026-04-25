# Jobs Page v2 Acceptance Tracker

Status: implementation phases `P0` through `P8` are in code. Acceptance is still open.

This document tracks the remaining acceptance work that must be completed outside the implementation pass.

## Release Gate

`P8` should not be treated as fully accepted until the LLM match-read path clears the agreement gate from the approved phase contract.

If LLM match-read is exposed to users before that gate is measured, that risk should be accepted explicitly in writing or the `llm` method should stay behind a flag.

## Open Items

1. `P6` staging PII review
   Confirm `jobs-v2:match_read_computed` and `jobs-v2:job_decision_made` payloads in staging contain no raw JD text, email addresses, or profile strings beyond the approved schema.

2. `P7` cohort gate threshold review
   Confirm the numeric threshold in code matches the approved PRD threshold.
   Current implementation uses `>=500` total `job_decision_made` events plus a thin-tier fallback guard of `>=10` tier-local decisions in [jobsPublic.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/jobsPublic.ts).

3. `P8` shadow agreement
   Measure agreement between keyword-overlap ground truth and LLM phrasing behavior on a real sample of user-confirmed fits.
   Required gate from the phase contract: `>=0.6`.

4. `P8` cost review
   Measure steady-state Mistral spend per opened job when cache warm-up is active.
   Review token usage and estimated cost from the `match_read_computed` telemetry payloads.

5. Browser verification pass
   Verify in a rendered browser session:
   - match block shows keyword-overlap copy before cache warm
   - match block shows LLM phrasing after cache warm
   - next-step block degrades to `Common next steps` when cohort data is thin
   - `Save for later` closes the detail pane on desktop

## Current Code Boundaries

- `P6` telemetry namespace: `jobs-v2`
- `P7` cohort fallback and thresholds: [jobsPublic.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/jobsPublic.ts)
- `P8` match-read synthesis cache + Mistral adapter:
  - [matchRead.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/lib/jobs/matchRead.ts)
  - [matchReadSynthesis.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/lib/jobs/matchReadSynthesis.ts)
  - [jobsPublic.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/jobsPublic.ts)

## Model Note

For the `P8` jobs match-read synthesis path specifically, the model name is resolved from `MISTRAL_MODEL` via [llmConfig.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/config/llmConfig.ts) and consumed as a plain string in [matchReadSynthesis.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/lib/jobs/matchReadSynthesis.ts).

That means the `P8` path can use a different Mistral model string without widening enums elsewhere, as long as the Mistral API accepts the exact model identifier.

This is not true for the full proposal-generation surface. Large parts of the wider repo still explicitly enumerate `mistral-small-latest` and `mistral-large-latest`, so a repo-wide switch to another Mistral variant would require broader follow-up work.
