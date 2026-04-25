# PR4B Legacy Finalization Stabilization Verification

Date: 2026-03-14

## Scope

- Verify the narrow legacy cover-letter finalization stabilization pass.
- Focus only on body-collapse avoidance, malformed-tail cleanup, and final bridge-cleanup consistency.
- Exclude prompt changes, rollout changes, schema changes, and API changes.

## Code Classification

- Active code
  - `my-app/convex/generateProposalMutation.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
- Informative prior audit context
  - `my-app/docs/audits/2026-03-14-pr4b-user-output-results-audit.md`
  - `my-app/docs/audits/2026-03-14-pr4b-proposal-generation-unblock-audit.md`

## Implemented Stabilization

1. Added test-visible finalization tracing for:
   - cleaned body selection
   - deterministic boundary application
   - final saved-output bridge cleanup
   - substantive-body assertion
2. Changed cover-letter saveability evaluation so bridge-neutralized factual prefixes can count during candidate selection.
3. Extended malformed-fragment cleanup to drop conjunction-plus-ellipsis residue such as trailing `and….`.
4. Kept stacked closing-tail normalization and added closing-tail fragment filtering inside body cleanup.
5. Extended final bridge cleanup coverage to treat `may offer relevant experience` the same as `may offer relevant perspective`.
6. Added a narrow alignment neutralization path for factual sentences of the form `... aligns with your need for ...`.

## Tests

- `npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalPersistenceSchemaAlignment.test.ts convex/lib/proposals/__tests__/proposalStructuredPath.test.ts convex/__tests__/proposalsPublic.test.ts`
  - passed
  - 54 tests
- `npx tsc --noEmit`
  - passed

## Added / Changed Regressions

- conservative candidate survives when aggressive cleanup collapses a valid cover letter
- true empty-shell cover letters still report `cleaned_body_selection` and fail closed
- known bridge patterns are removed from finalized saved cover letters when factual proof remains
- conjunction-plus-ellipsis truncation residue does not survive finalization

## Representative Case Verification

The pass was rechecked against representative user-style finalized artifacts from the prior audit.

1. `sadath_direct_cv`
   - classification: `bridge_cleaned`
   - result: saved
   - effect:
     - removed `aligns with your need for ...`
     - preserved the factual electrical-installation sentence
2. `sadath_signature_bridge_cv`
   - classification: `fail_closed`
   - collapse stage: `cleaned_body_selection`
3. `sadath_storyteller_shell_cv`
   - classification: `fail_closed`
   - collapse stage: `cleaned_body_selection`
4. `sadath_expert_nocv`
   - classification: `saved`
5. `robert_signature_malformed_cv`
   - classification: `malformed_fixed`
   - effect:
     - removed trailing `and….`
     - preserved the remaining valid security-monitoring sentence

## Remaining Fail-Closed Cases

- `sadath_signature_bridge_cv`
  - failure stage: `cleaned_body_selection`
- `sadath_storyteller_shell_cv`
  - failure stage: `cleaned_body_selection`

## Conclusion

The stabilization pass improved the narrow generator-side behaviors it targeted:

- conservative candidate selection now saves some bridge-heavy but still factual cover letters instead of failing closed
- malformed truncation residue no longer survives into finalized output
- final saved-output bridge cleanup is more consistent for the known patterns it already claimed to handle

True empty-shell cover letters still fail closed.

Some bridge-heavy variants still collapse at cleaned body selection, which keeps the next pass focused on narrow legacy finalization behavior rather than schema, rollout, or prompt work.
