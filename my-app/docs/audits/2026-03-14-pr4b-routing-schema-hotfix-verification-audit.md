# PR4B Routing Schema Hotfix Verification Audit

Date: 2026-03-14

## Scope

- Verify the routing-schema hotfix against the active proposal save path.
- Keep rollout scope fixed to legacy persistence behavior for this pass.
- Do not tune prompts, change rollout cohorts, or alter legacy generation behavior outside the save-path hotfix.

## Code Classification

- Active code
  - `my-app/convex/schema.ts`
  - `my-app/convex/proposals.ts`
  - `my-app/convex/generateProposalMutation.ts`
- Informative but non-authoritative for runtime validation
  - `my-app/convex/types/schema.ts`
  - `docs/audits/2026-03-14-pr4b-routing-schema-regression-audit.md`
- Unavailable local fixture coverage
  - no active Sadath proposal-generation fixture or reproducible case definition was found in the repo; only a name-format test fixture exists in `proposalWriterPrompt.test.ts`

## Hotfix Applied

1. `proposals.metadata` in `my-app/convex/schema.ts` now includes:
   - `planned_path`
   - `executed_path`
   - `fallback_reason`
   - `validator_outcome`
   - `save_outcome`
2. Added a regression test:
   - `my-app/convex/lib/proposals/__tests__/proposalPersistenceSchemaAlignment.test.ts`
3. Narrowed the parsed-save `try/catch` in `my-app/convex/generateProposalMutation.ts` so:
   - parse failures log as parse failures
   - parsed persistence failures surface as persistence failures
   - raw fallback is not triggered by a storage/schema exception from the parsed-save branch

## Verification Method

- Ran the active `handleGenerateProposal(...)` code path directly.
- Forced legacy routing with `ENABLE_PROPOSAL_STRUCTURED_MISTRAL=off`.
- Used a mocked save mutation that rejects any metadata field not present in the live `schema.ts` `proposals.metadata` validator.
- This reproduces the previously failing persistence boundary without changing generation logic.

## Before Hotfix

Observed live blocker:

- `Failed to insert or update a document in table "proposals" because it does not match the schema: Object contains extra field executed_path that is not in the validator. Path: .metadata`

Interpretation:

- proposal generation could succeed
- `storeProposal` arg validation could succeed
- table-schema persistence still failed on routing metadata

## After Hotfix

### Persistence crash after hotfix

- Not reproduced in the verified legacy-save cases below.
- All saved cases persisted routing metadata containing `planned_path`, `executed_path`, `fallback_reason`, `validator_outcome`, and `save_outcome`.

### Saved legacy output after hotfix

- `cv_security_signature`
  - saved
  - `save_outcome: legacy_saved_parsed`
- `cv_security_expert`
  - saved
  - `save_outcome: legacy_saved_parsed`
- `cv_security_direct`
  - saved
  - `save_outcome: legacy_saved_parsed`
- `cv_security_engaging`
  - saved
  - `save_outcome: legacy_saved_parsed`
- `nocv_security_signature`
  - saved
  - `save_outcome: legacy_saved_parsed`
- `cv_veteran_signature`
  - saved
  - `save_outcome: legacy_saved_parsed`
- `cv_veteran_expert`
  - saved
  - `save_outcome: legacy_saved_parsed`

For every saved case above:

- `planned_path: legacy`
- `executed_path: legacy`
- `fallback_reason: rollout_disabled`
- `validator_outcome: legacy_verified_clean`

### Still fail-closed after hotfix

- `nocv_security_expert`
  - did not save
  - error:
    - `Proposal generation failed closed during finalization. Attempted path: legacy-only path. Final result: fail-closed final result. Reason: Cleanup removed all substantive body content for cover_letter.`

Interpretation:

- this is no longer a persistence/schema problem
- it is a remaining legacy finalization/content-cleanup defect

## Notes

- One Mistral planner request hit a transient `429 rate_limited` response during the verification run, then recovered on retry; this did not change the final persistence classification above.
- The Sadath cases could not be re-run from local repo state because no active proposal-generation fixture or reproducible case payload was discoverable.

## Conclusion

The persistence blocker is fixed.

The active signal is now clean enough to separate:

1. schema-backed legacy saves that now persist successfully
2. remaining legacy fail-closed generation cases such as `nocv_security_expert`

The next pass should focus only on the remaining fail-closed content/finalization defects, not on proposal persistence.
