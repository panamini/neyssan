# QUALITY-EVAL-6 safe diagnostic integration

## Change contract

- Contract: `CC-20260717-QUALITY-EVAL-6-SAFE-DIAGNOSTIC-INTEGRATION-v2`
- Base: `0deb697ded4a081d01fdb17b80f2c7141e429b61`
- Active path: `human_review_only` cover-letter benchmark rail
- Risk: privacy-sensitive eval infrastructure; no product behavior

Allowed:

- derive one opaque arm id per accepted cell with one process-local run key;
- release the key immediately after derivation;
- keep opaque identity only in the private reveal map;
- extract allowlisted finalizer, quality, structure, language, and prompt-contract signals;
- seal diagnostics in a separately hashed `0600` private-reveal file;
- join diagnostics only after the existing complete blind-review gate succeeds.
- validate run and source identity before any live cohort call;
- bind retained manifest case, artifact, and provenance identity to extraction;
- require the exact current extractor contract in every sealed bundle;
- reject duplicate opaque arm ids before reviewer artifacts are built.

Forbidden:

- raw prompt, letter, rationale, provider response, error text, or secret in diagnostics;
- opaque identity or diagnostics in reviewer JSON/Markdown;
- provider, reviewer, adjudicator, held-out, product-route, model, prompt, finalizer, or wiki changes;
- publication or merge without a separate instruction.

## Verification contract

- focused safe-arm, bundle, and blind-review tests;
- neighboring offline cover-letter eval tests;
- TypeScript, exact-file lint, formatting, and `git diff --check`;
- read-only Fallow and fresh changeset review before publication.

This slice improves diagnostic validity only. It does not claim a letter-quality
win or select a product-default model.
