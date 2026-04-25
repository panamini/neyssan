# PR4B Proposal Generation Unblock Audit

Date: 2026-03-14

## Scope

- Unblock saved proposal reads after routed metadata was added to persisted `proposals.metadata`.
- Reproduce and classify the remaining legacy fail-closed generation path using the Ascension Jacksonville security job description from the incident log.
- Keep rollout, prompts, and legacy tuning unchanged in this pass.

## Code Classification

- Active code
  - `my-app/convex/proposalsPublic.ts`
  - `my-app/convex/proposals.ts`
  - `my-app/convex/schema.ts`
  - `my-app/convex/generateProposalMutation.ts`
- Active regression coverage
  - `my-app/convex/lib/proposals/__tests__/proposalPersistenceSchemaAlignment.test.ts`
  - `my-app/convex/__tests__/proposalsPublic.test.ts`
- Informative test coverage for finalization behavior
  - `my-app/convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts`
  - `my-app/convex/lib/proposals/__tests__/proposalEnforcement.test.ts`
- Uncertainty
  - live Mistral responses for legacy no-context cover letters remain non-deterministic across repeated runs, so matrix classifications below should be treated as observed outcomes for this audit date, not permanent guarantees

## Read-Path Root Cause

The client-side `ReturnsValidationError` was not a table-schema failure.

Root cause:

- `proposalsPublic:default` still declared an older `returns.metadata` shape
- the query handler returned raw `proposals` documents
- saved proposal documents now include routed metadata keys:
  - `planned_path`
  - `executed_path`
  - `fallback_reason`
  - `validator_outcome`
  - `save_outcome`
- Convex rejected the public query response during return validation because `executed_path` and the other routed fields were present in the returned object but absent from the query validator

## Read-Path Hotfix Applied

In `my-app/convex/proposalsPublic.ts`:

1. Extended `returns.metadata` to include the routed persistence fields above.
2. Added the already-persisted public metadata fields that were also being returned from saved proposal documents:
   - `sourceJobDescription`
   - `voicePreset`
   - `formalityLevel`
   - `creativity`
   - `proposalType`
3. Changed the handler to project proposal documents to the declared public return shape instead of returning raw documents.

In `my-app/convex/lib/proposals/__tests__/proposalPersistenceSchemaAlignment.test.ts`:

1. Extended the schema-alignment regression so proposal metadata fields now stay aligned across:
   - `storeProposal`
   - `schema.ts` `proposals.metadata`
   - `proposalsPublic.ts` `returns.metadata`

## Read-Path Verification

### Query handler verification

Ran the public query handler directly with a mocked saved proposal document that contained:

- all routed metadata fields
- all existing public metadata fields
- extra undeclared fields:
  - `metadata.extra_runtime_only`
  - `otherFutureField`

Observed result:

- routed metadata fields were returned successfully
- undeclared extra fields were not returned
- this removes the specific `ReturnsValidationError` trigger from the public query path

Interpretation:

- saved proposals with routed metadata can now be returned through `proposalsPublic:default`
- projecting the return shape protects the client from future unrelated storage-field additions
- this projection behavior is now covered by `my-app/convex/__tests__/proposalsPublic.test.ts`

## Ascension Reproduction Input

Canonical repro job:

- Ascension St. Vincent's Riverside Hospital
- Jacksonville, Florida
- Security Officer / security campus coverage
- exact incident JD text from the runtime log was used

Execution controls:

- `ENABLE_PROPOSAL_STRUCTURED_MISTRAL=off`
- active `handleGenerateProposal(...)` path
- mocked save mutation rejecting metadata keys not present in live `schema.ts`
- no prompt edits
- no schema edits during reproduction
- no rollout changes

## Ascension Matrix

### Single-pass matrix run

1. `ascension_cv_signature`
   - `saved`
   - routing metadata:
     - `planned_path: legacy`
     - `executed_path: legacy`
     - `fallback_reason: rollout_disabled`
     - `validator_outcome: legacy_verified_clean`
     - `save_outcome: legacy_saved_parsed`
2. `ascension_nocv_signature`
   - `saved`
   - routing metadata:
     - `planned_path: legacy`
     - `executed_path: legacy`
     - `fallback_reason: rollout_disabled`
     - `validator_outcome: legacy_verified_clean`
     - `save_outcome: legacy_saved_parsed`
3. `ascension_cv_expert`
   - `fail_closed`
   - error:
     - `Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.`
4. `ascension_nocv_expert`
   - `fail_closed`
   - error:
     - `Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.`

### Targeted repeat loop on the reported no-CV signature path

Because the incident symptom was broader than the single-pass matrix result, the no-CV `signature` case was rerun in a focused loop with writer-output capture.

Observed outcomes:

- attempt 1: `saved`
- attempt 2: `fail_closed`

Interpretation:

- the no-CV `signature` path is currently flaky, not stably healthy
- the broader user symptom of “can’t generate anything anymore” is consistent with live-output variability on the legacy path, not with the already-fixed persistence schema blocker

## Fail-Closed Stage Classification

Targeted reproduced case:

- `ascension_nocv_signature`
- repeat-loop attempt 2

Captured raw writer output immediately before finalization:

> The security officer role at Ascension St. Vincent’s Riverside Hospital aligns with my interest in proactive safety and emergency preparedness. The hospital’s commitment to community well-being and professional development resonates with my approach to security work. I appreciate the opportunity to contribute to a team that prioritizes staff and visitor safety through structured patrols and incident management.
>
> The responsibilities described—such as conducting emergency drills and managing security incidents—reflect the kind of detail-oriented work I find engaging. I understand the importance of maintaining a secure environment, and I’m prepared to support the hospital’s mission by adhering to established protocols and collaborating with staff. I’d welcome the chance to discuss how my skills and dedication could align with this role.

Stage classification:

- body selection: failed
- deterministic boundary application: not reached
- final saved-output bridge guard: not reached
- substantive-body assertion: not reached

Evidence:

- replaying the captured writer output through `finalizeProposalForSave(...)` reproduced:
  - `Cleanup removed all substantive body content for cover_letter.`
- this means the collapse happens inside the initial body-selection cleanup path before deterministic render boundaries are applied

## Interpretation

Two independent blockers were present:

1. Read-path validator drift
   - fixed in `proposalsPublic.ts`
   - no longer a reason the proposal list crashes when routed metadata is present
2. Legacy finalization instability
   - still active
   - currently reproducible on live Ascension cases
   - at least one reproduced failure collapses during initial body selection in `finalizeProposalForSave(...)`

This means the persistence hotfix remains valid, but it does not solve the remaining generation failures.

## Verification Summary

- `npx vitest run convex/__tests__/proposalsPublic.test.ts convex/lib/proposals/__tests__/proposalPersistenceSchemaAlignment.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalStructuredPath.test.ts`
  - passed
  - 50 tests
- `npx tsc --noEmit`
  - passed
- public query handler mock verification
  - routed metadata returned successfully
  - extra undeclared fields stripped successfully

## Conclusion

The public proposal read path is unblocked.

The remaining failures are now isolated to live legacy generation/finalization behavior, not routed metadata schema drift.

Current active signal on 2026-03-14:

- `proposalsPublic:default` required schema-aligned projection and is now aligned
- legacy generation is still unstable for the Ascension security repro
- the reproduced no-CV `signature` fail-closed path collapses during initial body selection before any deterministic output wrapper is applied
