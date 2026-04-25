# Proposal Quality Convergence Plan

Date: 2026-03-15

## Scope

- Audit the latest live outputs after the recent extractor and no-context selector passes.
- Explain the remaining issues from a whole-pipeline viewpoint.
- Recommend the smallest next steps that improve output quality without reopening broad architecture unnecessarily.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/proposalPlanner.ts`
  - `my-app/convex/lib/proposals/proposalRenderer.ts`
  - `my-app/convex/lib/proposals/proposalEnforcement.ts`
- User-provided live evidence
  - Hogan Lovells `no-cv` outputs
  - Hogan Lovells and hotel-security `cv` outputs
- Uncertainty
  - some pasted sections appear duplicated or mislabeled
  - if two full letters were pasted under one tone label, that may be a user paste merge rather than a single saved output

## Current Architecture Picture

The pipeline now has five practical stages:

1. planner and evidence summary selection
2. body generation
3. extraction and normalization
4. saveability / deterministic cleanup
5. deterministic rendering of salutation, close, and sign-off

The recent work improved stages 2 through 4 materially:

- wrapped-body recovery is better
- no-context selector false-negatives are reduced
- some weak no-context outputs now save as grounded letters instead of failing closed

The remaining quality issues are now split across different layers:

1. some deterministic cleanup gaps still survive
2. the deterministic renderer is intentionally flattening closings
3. the legacy generation path still overuses the same safe evidence and close patterns across tones
4. weak or repetitive outputs are often technically saveable, so they survive without being the best available wording

## Audit Of Latest Results

### 1. No-context outputs are materially better but still uneven

Good signs:

- `signature nocv` is now grounded in actual job work instead of generic admiration
- `engaging nocv` and `storyteller nocv` are closer to acceptable JD-grounded prose
- a grounded Hogan Lovells no-context draft can now save without false-negative collapse

Remaining issues:

- `expert nocv` still fails closed when the body is mostly interest-led shell language
- some saved no-context outputs are still thin because only two JD-summary sentences survive
- if `signature nocv` really ever contains CV-backed facts, that is a separate context/mode-leak anomaly, not part of normal no-context quality

### 2. CV-backed quality is still limited by stereotyped evidence ordering and safe boilerplate

Observed patterns:

- different tones often open from the same top fact
- many outputs end with the same renderer-owned closing sentence
- several tones differ only in sign-off and minor phrasing, not in actual rhetorical shape

This is not accidental. The deterministic renderer currently owns the final sentence:

- `I would welcome the opportunity to discuss the position further.`
- `I would welcome the opportunity to discuss my interest in the role.`

That behavior comes from `proposalRenderer.ts`, not from the model alone.

### 3. Deterministic cleanup still misses some crisp bad survivors

Still-visible deterministic issues:

- malformed fragment survivors such as orphan or clipped sentences
- CV bridge leakage families like `could offer relevant perspective`
- alignment variants like `align with ... required for this role`
- possible lowercase restart or truncated-fragment survivors in some tone variants

These are not broad architecture problems anymore. They are narrow lexical cleanup gaps.

### 4. Tone differentiation is still too shallow

The current presets mostly change:

- sign-off
- warmth level
- surface rhythm

They often do not change:

- which evidence point leads
- which paragraph purpose comes first
- how much concrete detail versus framing each tone gets

That is why outputs feel stereotyped even when they are technically different.

## Why The Same Closing Keeps Repeating

The repeated final sentence is coming from deterministic rendering, not just repeated model behavior.

Current behavior:

- the writer generates body-only text
- the renderer appends a safe final sentence based only on format and `noContextMode`
- tone affects sign-off more than it affects the closing invitation itself

This is directionally safe, but it creates visible monotony across tones.

## Best Next Steps

### Step 1. Finish the remaining deterministic cleanup misses

Keep this small and local:

1. finish the no-context lexical cleanup families that are still confirmed in live evidence
2. finish the CV malformed-fragment cleanup families
3. finish the CV bridge-guard lexical variants

Why first:

- these are deterministic
- they are easy to test
- they reduce obvious bad saves before trying to make prose more elegant

### Step 2. Make deterministic closing safe but not identical

Small module or small extension:

- add a tiny safe close policy keyed by:
  - format
  - `noContextMode`
  - voice preset
- keep the same safety class
- rotate among 2 to 3 approved closing variants per mode instead of one universal sentence

Best place:

- `my-app/convex/lib/proposals/proposalRenderer.ts`

This is the cleanest way to solve the repeated `I would welcome the opportunity ...` problem without pushing more burden back onto generation.

### Step 3. Use the evidence summary to vary paragraph roles, not just fact choice

Do not invent a large new subsystem first.

Use the existing planner and content-plan pipeline to make tones differ by paragraph function:

- `signature`: lead with strongest proof, then concise second proof
- `expert`: lead with proof, then process/analysis framing
- `direct`: lead with strongest fact, keep one short second fact, close
- `engaging`: lead with proof, then one human-facing or collaboration-facing sentence
- `storyteller`: lead with concrete evidence, then one short narrative bridge, not a generic abstract paragraph

This should happen in the content-plan / writer-plan layer, not by adding more random prompt adjectives.

### Step 4. Add a tiny post-generation candidate scorer

If one new module is worth adding, this is the best one:

- `my-app/convex/lib/proposals/proposalCandidateScorer.ts`

Purpose:

- score generated candidate bodies before final save

Suggested signals:

- grounded evidence density
- JD-operational grounding
- repetition penalty
- bridge-risk penalty
- fragment penalty
- tone-differentiation bonus or penalty

Use it only to pick the best candidate among already-allowed outputs.
Do not use it to loosen guards.

This is the best-practice next module if quality stagnates after the smaller deterministic passes.

### Step 5. Converge more traffic onto the structured path over time

The long-term best architecture is not to keep making the legacy path smarter forever.

The structured path already has the right components:

- planner result
- content plan
- constrained body composer
- verifier
- repair pass
- deterministic renderer

Once the remaining deterministic cleanup gaps are closed, the best medium-term move is:

- make structured generation the default for more cover-letter traffic
- keep legacy as fallback
- use live fallback reasons as the prioritization input

## Recommended Order

### Immediate

1. finish no-context lexical cleanup
2. finish CV malformed-fragment and bridge cleanup
3. add fail-trace capture where traces are still incomplete

### Next

4. vary deterministic close policy in `proposalRenderer.ts`
5. tighten tone-specific paragraph role guidance in the structured content-plan path

### After That

6. add `proposalCandidateScorer.ts` if outputs are still too stereotyped or repetitive
7. expand structured-path coverage and reduce legacy reliance

## Decision

The best whole-picture strategy is:

1. finish the remaining deterministic cleanup gaps
2. stop forcing one universal closing sentence across all tones
3. make tones differ by paragraph role, not just by sign-off
4. add a small scorer if needed
5. continue shifting quality-sensitive cover letters toward the structured path instead of endlessly extending the legacy path
