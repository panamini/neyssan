# PR4B Post No-CV Pass Live Output Audit

Date: 2026-03-15

## Scope

- Audit the latest user-provided live proposal outputs after the narrow no-CV cleanup pass.
- Identify which problems are still deterministic cleanup misses versus upstream generation variance.
- Recommend the next narrow implementation pass without reopening prompts, rollout, schema, or API work.

## Evidence Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/proposalEnforcement.ts`
- User-provided live evidence
  - Marion frontend/distant-role CV outputs across `signature` and `expert`
  - Robert Cooper security CV outputs across `expert`, `direct`, `engaging`, `storyteller`
  - no-CV security outputs across `signature`, `expert`, `direct`, `engaging`, `storyteller`
- Deterministic local repro method
  - re-ran representative saved outputs through `inspectProposalFinalization(...)` to check whether the current finalizer would still remove, neutralize, or preserve the leaked sentences
- Uncertainty
  - exact pre-finalization draft content is unavailable for the live fail-closed requests
  - unsupported-claim findings remain conditional when exact allowed fact sets are not visible in this thread

## Findings

### 1. High: malformed CV-backed sentence fragments are still surviving finalization unchanged

Observed live outputs:

- Marion `signature cv`
  - `Working directly with clients in Paris and Washington D. C.`
- Marion `expert cv`
  - `The role at WilsonAI.`

Deterministic recheck:

- passing both outputs back through `inspectProposalFinalization(...)` preserved those lines unchanged
- this means the current finalizer does not recognize them as malformed or low-value survivors

Relevant code:

- `cleanProposalBodyText(...)` and malformed-fragment filtering in `my-app/convex/generateProposalMutation.ts`
- `finalizeProposalForPersistence(...)` in `my-app/convex/generateProposalMutation.ts`

Assessment:

- this is no longer just a prompt-quality issue
- it is a deterministic cleanup miss in the CV-backed path

### 2. High: residual CV-backed bridge leakage is still getting through the final saved-output guard

Observed live outputs:

- Robert `storyteller cv`
  - `These skills in safety compliance and troubleshooting align with the proactive patrols and threat monitoring required for this role.`
  - `My criminal justice knowledge and hands-on experience in loss prevention could offer relevant perspective for emergency drills and incident management.`

Deterministic recheck:

- re-running that saved output through `inspectProposalFinalization(...)` preserved both sentences unchanged

Relevant code:

- final saved-output bridge detection and neutralization in `my-app/convex/generateProposalMutation.ts`
  - `isFinalSavedOutputSoftBridgeSentence(...)`
  - `neutralizeFinalSavedOutputBridgeSentence(...)`
  - `applyFinalSavedOutputBridgeGuard(...)`

Assessment:

- the current bridge guard covers `may offer relevant experience/perspective`
- it does not cover the observed `could offer relevant perspective` variant
- the alignment guard is also not catching the observed `align with ... required for this role` phrasing

### 3. High: the no-CV cleanup pass is still incomplete for the live weak-survivor patterns

Observed live saved outputs:

- `expert nocv`
  - `I appreciate the opportunity to develop skills in disaster response and environmental safety within a mission-driven organization.`
- `engaging nocv`
  - `The emphasis on emergency preparedness and incident management aligns with a commitment to maintaining secure and orderly operations, which is central to the hospital’s mission.`
  - `The chance to engage with diverse teams and develop skills in disaster response would be a meaningful part of the work.`
  - `The details shared about the position highlight the kind of impactful work that draws me to this opportunity.`
- `storyteller nocv`
  - `The emphasis on emergency preparedness, staff safety, and proactive threat monitoring.`
  - `I appreciate the opportunity to develop skills in disaster response and environment of care within a supportive, values-based organization.`

Deterministic recheck:

- re-running each saved no-CV output through `inspectProposalFinalization(...)` left them unchanged
- `noContextLeadCleanup` reported no removals or neutralizations for these exact cases

Relevant code:

- no-context early-body cleanup in `my-app/convex/generateProposalMutation.ts`
  - `getNoContextEarlyBodySentenceCleanup(...)`
  - `cleanupNoContextEarlyBodySentences(...)`

Assessment:

- the current no-CV pass improved the earlier audited patterns
- it does not yet cover the new live lexical families above
- this is the clearest remaining deterministic gap from the current pass

### 4. Medium: some live fail-closed cases remain, but their collapse stage is not recoverable from the current logs alone

Observed live errors:

- `engaging cv`
- `signature nocv`
- `direct nocv`

Runtime error:

- `Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.`

Relevant code:

- `coerceProposalFinalizationFailureToConvexError(...)` in `my-app/convex/generateProposalMutation.ts`
- `handleGenerateProposal(...)` in `my-app/convex/generateProposalMutation.ts`

Assessment:

- the logs confirm fail-closed behavior but not the exact stage or surviving candidate text
- no new salvage logic should be added until one of these requests is reproduced with finalization trace data

## Conclusion

The current baseline is still directionally correct:

1. true shell drafts should keep failing closed
2. no-CV cleanup should stay local and deterministic
3. broad claim-policy redesign should stay out of scope

The active problems have narrowed to:

1. residual no-CV lexical cleanup misses
2. CV-backed malformed fragment survivors
3. CV-backed bridge-cleanup lexical misses
4. live fail-closed requests that now need stage-traced reproduction instead of guessing

## Recommended Next Pass

1. Finish the no-CV cleanup pass with exact lexical extensions for the still-live misses:
   - `I appreciate the opportunity to develop skills ...`
   - `The chance to engage ... develop skills ...`
   - `The details shared about the position highlight ...`
   - bare `The emphasis on ...` fragment openers
   - `aligns with a commitment to ...`
2. After that, do a separate narrow CV-backed cleanup pass:
   - drop orphan fragments like `Working directly with clients in Paris and Washington D. C.` and `The role at WilsonAI.`
   - extend final bridge cleanup to catch `could offer relevant perspective` and the observed `align with ... required for this role` variant
3. Add failure-trace capture for live fail-closed requests so `engaging cv`, `signature nocv`, and `direct nocv` can be classified by exact stage before any new salvage logic is proposed.
