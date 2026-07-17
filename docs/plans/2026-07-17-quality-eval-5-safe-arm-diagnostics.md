# QUALITY-EVAL-5 safe-arm diagnostic integration contract

## Current boundary

The committed active cover-letter eval path is:

`benchmarkCoverLetterCaseForHumanReview` -> `prepareCoverLetterEvalArtifact` -> final-visible sendability shadow -> blind reviewer pack/reveal map -> run manifest.

The path has safe hashes and allowlisted cell diagnostics, but no separate sealed diagnostic file and no opaque arm id at the generation callback boundary. The reviewer pack must remain unchanged and must never receive arm identity or safe-arm diagnostics.

## Next integration slice

At generation/finalization time, the active runner should:

1. Derive one `opaqueArmId` from the run id, fixture/cell id, and a bounded arm key; retain only the derived id.
2. Capture prompt-contract hash status from the existing prompt/schema callbacks and the finalizer/artifact hashes from the finalized record. Never pass prompt, letter, rationale, provider response, or error text to the diagnostic builder.
3. Build one `cover_letter_safe_arm_diagnostic_v1` record with the allowlisted codes, booleans, counts, hashes, and explicit provenance values from `cover-letter-safe-arm-diagnostic.ts`.
4. Write diagnostics to a separately permissioned private-reveal file whose body is independently hashed. Do not add the diagnostic or arm id to the reviewer pack, Markdown, blind decision input, or reviewer-safe projection.
5. After `revealCompletedCoverLetterBlindReviews` returns a complete blind decision, join by run id, source ref, pack hash, fixture/cell id, and artifact hash; reject incomplete or mismatched joins.

The integration must remain offline-capable, provider-neutral, and eval-only. Missing generation/finalization signals stay `MISSING_NOT_RECONSTRUCTABLE`; winner labels must never populate them.
