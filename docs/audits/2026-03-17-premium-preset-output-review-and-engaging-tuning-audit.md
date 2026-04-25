# Premium Preset Output Review And Engaging Tuning Audit

Date: 2026-03-17

## Scope

- premium `cover_letter` only
- `gpt-5.4` only
- real output review across `signature`, `expert`, and `engaging`
- narrow preset/body-contract refinement only if the reviewed outputs showed a recurring issue

## Reviewed output set

Live premium outputs were reviewed across:

- strong direct: `security-hyatt`
- strong adjacent: `strong-adjacent-honest-transfer`
- weaker adjacent: `adjacent-warehouse`
- modest-evidence direct: `ops-admin`
- no-CV: `nocv-ops`

Each family was generated across:

- `signature`
- `expert`
- `engaging`

## Findings

- Runtime/path status: no meaningful parser/output-shape issue was observed in this review set. All reviewed premium generations succeeded on the structured path.
- `signature` now reads like a credible premium default in most reviewed cases:
  - warm-professional
  - concise
  - evidence-led
  - better than `expert` in no-CV
- `expert` still reads like the more controlled analytical option:
  - slightly more operating-context framing
  - more explicit explanation of why the evidence matters in workflow terms
- The remaining weak preset was `engaging`.

### Why `engaging` was still weak

Before the patch, `engaging` often stayed too close to the neutral base template:

- employer-value blocks still opened with flat relevance summary language
- warmth often showed up only as slightly softer phrasing
- modest-direct and no-CV cases still risked sounding like a neutral role summary rather than a warmer but concrete premium letter

This was most visible in:

- `ops-admin engaging`
- `nocv-ops engaging`
- some adjacent `engaging` outputs where the body remained operationally sound but not meaningfully more human than `signature`

## Classification

- Primary issue: `preset-expression issue`
- Layer: `prompt/body-contract issue`
- Not a composition-brief issue
- Not a parser/output-shape issue
- Not a routing/fallback issue

## Change

- Tightened only the premium `engaging` guidance line in `convex/lib/proposals/premiumCoverLetter.ts`
- New contract emphasis:
  - one grounded sentence should show who benefits when coordination, reporting, service, or follow-through are done well
  - use team / stakeholder / customer / guest / vendor / user context when supported
  - avoid flat neutral relevance-summary lead-ins
  - keep warmth concrete rather than enthusiastic

## Validation

- `npm test -- premiumCoverLetter.test.ts`
  - result: `24/24` tests passed
- Post-change live `engaging` checks stayed premium-stable across:
  - `security-hyatt`
  - `strong-adjacent-honest-transfer`
  - `adjacent-warehouse`
  - `ops-admin`
  - `nocv-ops`

## Outcome

- `engaging` now reads more distinctly from the neutral template without becoming fluffier
- `signature` remains the strongest overall default baseline
- `expert` remains the more analytical option
- no evidence hierarchy, honesty, or routing behavior changed

## Recommendation

- Keep this change.
- Do not tune `signature` again unless a fresh review shows a real regression.
- If any preset still needs another pass, `engaging` remains the only justified target, and only in the same prompt/body-contract layer.
