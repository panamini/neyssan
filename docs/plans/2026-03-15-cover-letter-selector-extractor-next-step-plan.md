# Cover Letter Selector And Extractor Next-Step Plan

Date: 2026-03-15

## Goal

Move the legacy cover-letter pipeline closer to the product goal:

1. CV ingestion/parsing
2. canonical saved profile/CV facts
3. proposal generation that saves strong outputs when credible evidence or grounded JD context exists
4. fail-closed behavior only for true shells or unsupported transfer cases

This plan treats the latest live results as an architecture-level signal, but keeps the next implementation step small, testable, and reversible.

## Active Code

- `my-app/convex/generateProposalMutation.ts`
- `my-app/convex/lib/proposals/proposalEnforcement.ts`
- `my-app/convex/lib/proposals/proposalPlanner.ts`

## Architecture View

The pipeline now has four distinct stages:

1. planner and writer guidance
2. raw draft generation
3. extraction and normalization of the raw draft into a cover-letter body
4. finalization and saveability selection

The recent passes improved stage 1 materially:

- no-CV generation is more JD-grounded than before
- CV-backed generation uses evidence summaries better in some closer-role cases
- writer-discipline guidance is already stronger for first-person consistency and sentence closure

Because of that, the latest failures are no longer primarily prompt-quality failures.

The remaining issues are now concentrated in stages 3 and 4:

1. no-CV bodies that contain grounded JD sentences are still sometimes rejected as unsaveable
2. wrapped CV drafts still sometimes collapse to empty before the finalizer can evaluate the body

## Audit Of Latest Results

### 1. High: no-CV false-negative fail-close in cleaned-body selection

Observed latest Hogan Lovells no-CV traces:

- `signature nocv`
- `expert nocv`
- `direct nocv`

All three traces include grounded JD-body content such as:

- `The role at Hogan Lovells involves coordinating marketing campaigns...`
- `This includes drafting proposals, maintaining marketing collateral...`
- `The position requires collaboration with global teams...`

Yet they still fail at:

- `failureStage: 'cleaned_body_selection'`

Relevant active code:

- `GENERIC_ROLE_SUMMARY_SENTENCE_PATTERNS` in `my-app/convex/generateProposalMutation.ts`
- `sentenceLooksGenericRoleSummary(...)` in `my-app/convex/generateProposalMutation.ts`
- `sentenceHasGroundedWorkSurfaceDetail(...)` in `my-app/convex/generateProposalMutation.ts`
- `sentenceLooksSaveableWorkSurfaceSentence(...)` in `my-app/convex/generateProposalMutation.ts`
- `hasSaveableBodyContent(...)` in `my-app/convex/generateProposalMutation.ts`

Assessment:

- the current no-CV writer is now producing more concrete JD-grounded work sentences
- the selector still over-penalizes role-summary sentence shapes that begin with `The role ...`, `The position ...`, or similar openers
- this is now a selector/classification problem, not mainly a prompt problem

### 2. High: wrapped CV drafts still collapse before meaningful body recovery

Observed latest CV fail-closed traces:

- `engaging cv`
- `storyteller cv`
- distant-role `storyteller cv`

These traces include wrapper-heavy drafts such as:

- `Here’s a tailored cover letter ...`
- markdown separators like `---`
- valid body paragraphs
- trailing editorial explanation like `This version adheres ...`

Relevant active code:

- `extractFinalProposalContent(...)` in `my-app/convex/lib/proposals/proposalEnforcement.ts`
- `findEditorialBoundaryIndex(...)` in `my-app/convex/lib/proposals/proposalEnforcement.ts`
- `buildCoverLetterBodyCandidate(...)` in `my-app/convex/lib/proposals/proposalEnforcement.ts`
- `stripLeadingMetaOutput(...)` in `my-app/convex/generateProposalMutation.ts`

Assessment:

- the wrapper family is already partially recognized
- however, some wrapped drafts still end up with empty aggressive and conservative candidates
- this is now an extraction/body-candidate recovery problem, not a broad finalization-floor problem

### 3. Medium: residual weak saves remain, but they are not the next best lever

Observed residual weak families:

- distant-role weak saves with cautious-but-thin transfer language
- some closer-role CV outputs still drift into JD mirroring after one concrete evidence sentence

Assessment:

- these are real quality issues
- they are lower leverage than the two deterministic choke points above
- they should not be the next change while false-negative fail-closes are still present

## Smallest Functioning Next Step

Implement one narrow selector patch in `my-app/convex/generateProposalMutation.ts`:

1. keep generic-role-summary rejection for thin shells
2. but allow role/position-opening sentences to count as saveable no-CV work-surface sentences when they contain concrete JD-grounded operational detail

Target functions:

- `sentenceLooksGenericRoleSummary(...)`
- `sentenceLooksSaveableWorkSurfaceSentence(...)`
- if needed, a small helper such as `sentenceLooksGroundedRoleSummarySentence(...)`

Desired behavior:

- `The role at Hogan Lovells involves coordinating marketing campaigns...` should count as a saveable work-surface sentence
- `This includes drafting proposals, maintaining marketing collateral...` should count as a saveable work-surface sentence
- thin generic shells like `The role is interesting.` should still fail
- no acceptance-floor change
- no no-CV salvage logic
- no prompt rewrite

Why this is the smallest correct next step:

- it addresses the current false-negative fail-close class directly
- it fits the existing architecture instead of fighting it
- it preserves the current product principle that true shells fail closed

## Next Step After That

After the selector patch lands and is verified, do a separate narrow extractor pass in `my-app/convex/lib/proposals/proposalEnforcement.ts`.

Focus:

1. reproduce wrapped `engaging` and `storyteller` CV failures
2. inspect how `extractFinalProposalContent(...)` chooses between body candidates when wrapper lines and editorial tails are present
3. make the smallest recovery fix that preserves existing wrapper stripping for already-passing cases

This should remain separate from the selector fix so each pass is easy to validate.

## What To Defer

Defer these until the two deterministic choke points above are fixed:

1. distant-role weak-save policy tightening
2. broader CV evidence-summary refinement
3. additional no-CV rhetorical shaping
4. any change to saveability floors or fallback policy

## Proposed Implementation Order

1. selector fix for grounded no-CV role-summary sentences
2. regression tests for the three Hogan Lovells no-CV false-negative fail-closed traces
3. extractor fix for wrapped engaging/storyteller CV drafts
4. regression tests for wrapped CV body recovery
5. only then re-audit weak saved outputs

## Test Strategy

### Selector patch tests

- replay the Hogan Lovells `signature nocv` trace body and confirm it no longer fails at `cleaned_body_selection`
- replay the Hogan Lovells `expert nocv` trace body and confirm it no longer fails at `cleaned_body_selection`
- replay the Hogan Lovells `direct nocv` trace body and confirm it no longer fails at `cleaned_body_selection`
- preserve a true-shell no-CV fail-closed regression

### Extractor patch tests

- wrapped `Here’s a tailored cover letter ... --- body --- This version adheres ...` content must recover the body
- existing wrapped-body regressions must remain green
- fail-closed should still happen for genuinely unsupported distant-role CV drafts when the recovered body is still too weak

## Decision

The smallest functioning next step is not another prompt pass.

It is a narrow saveability-selector fix for grounded no-CV role-summary sentences, followed by a separate extractor recovery pass for wrapped CV drafts.
