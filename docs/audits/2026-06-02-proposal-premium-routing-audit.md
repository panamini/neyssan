# Proposal Premium Routing Audit - 2026-06-02

## Scope

Audit and minimally harden the live proposal generation path so premium provider routing is provable without enabling broad structured Mistral rollout, without modifying `.env`, API keys, Docker, or DB data.

## Confirmed Active Code

- `my-app/convex/generateProposalMutation.ts` is the active backend generation path used by `api.functions.generateProposal`.
- `my-app/src/components/ProposalInputForm.tsx` passes the backend result into Proposal Forge.
- `my-app/src/components/ProposalDisplay.tsx` renders the result panel.
- `my-app/convex/updateProposalPublic.ts` is the public metadata patch path used by Proposal Forge after generation.

## Confirmed Fixes

- Mistral Medium and Mistral Large cover-letter requests enter the premium attempt before structured or legacy fallback when eligibility and credentials are present.
- The Mistral premium writer uses `writerProvider: "mistral"` and `process.env.MISTRAL_API_KEY`; it does not call the OpenAI premium writer for Mistral.
- Backend generation returns a `routing` summary containing attempted/planned/executed path, fallback reason, validator outcome, save outcome, and premium failure trace fields.
- Proposal Forge carries `routing` through the successful submit callback.
- Proposal Display exposes a dev/local routing disclosure so the displayed result can be tied to the backend route.
- Public proposal metadata updates preserve existing generation routing tags by unioning old and incoming `metadata.tags`.
- `my-app/scripts/evals/smoke-live-premium-routing.ts` provides a no-DB, process-env-only live route smoke for OpenAI, Mistral Medium, Mistral Large, and Qwen.
- `handleGenerateProposal` now has an explicit `GenerateProposalResult` return type that includes the routing summary consumed by the smoke harness.
- Proposal style tracing is opt-in via `proposal_style_trace_enabled=true` in local storage, preventing repeated `[proposal-style-trace]` console spam during normal Proposal Forge use.
- Proposal Forge autosave no longer re-runs only because `composeSaveStatus` changed.
- Mistral premium repair now gets explicit unsupported-ownership guidance and one repair attempt for Mistral-only `unsupported_ownership_verb` failures; Qwen remains strict.
- Cover-letter finalization now fails closed before persistence when a generated document repeats the salutation/opening, repeats exact substantive body paragraphs, emits substantive body content after a sign-off, or leaves a comma-led dangling abstract noun fragment such as `, experience.`. This covers the live GPT/Mistral Medium duplicate-output and malformed-fragment shapes without provider-specific or security-job-specific heuristics.
- Forge template panel registration cleanup is deferred and cancelled by same-surface replacement registrations, preventing delete/add registration oscillation while preserving live drawer content updates.

## Verification Run

Command:

```bash
rtk npx vitest run convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/premiumCoverLetter.test.ts convex/lib/proposals/__tests__/proposalStructuredPath.test.ts src/lib/__tests__/proposal-personalization.test.ts scripts/evals/__tests__/benchmark-cover-letter-writers.test.ts scripts/evals/__tests__/smoke-live-premium-routing.test.ts convex/__tests__/proposalPublicStyleCompatibility.test.ts src/lib/__tests__/proposal-generation-ui.test.ts src/lib/__tests__/proposal-style-trace.test.ts src/components/__tests__/ProposalInputForm.provider-busy.test.tsx src/pages/__tests__/ProposalForge.provider-busy.test.tsx src/pages/__tests__/ProposalForge.job-resume-scope.test.tsx
```

Result after the latest trace/autosave, Mistral repair, and job/CV scope changes: 12 files passed, 177 tests passed.

Additional targeted regression:

```bash
rtk npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts -t "accepts duration-led first-person CV evidence during premium finalization"
```

Result: 1 test passed.

Additional duplicate-output regressions:

```bash
rtk npx vitest run convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts -t "fails closed when a cover letter repeats|fails closed when body content repeats|malformed trailing noun fragments|dedupes repeated evidence|fails closed on the ADT/Copwatch legacy fallback fragment"
```

Result: 5 tests passed.

Additional panel registration lifecycle regressions:

```bash
rtk npx vitest run src/components/__tests__/ForgeTemplateEntryPoints.test.tsx -t "keeps a focused heading text input|preserves spaces and cursor position|opens proposal heading|opens proposal draft"
```

Result: 4 tests passed.

Diff check:

```bash
rtk git diff --check
```

Result: clean.

Live-route smoke harness without opt-in:

```bash
rtk npx tsx scripts/evals/smoke-live-premium-routing.ts --models=mistral-medium-latest,mistral-large-latest,qwen3.7-max,chatgpt
```

Result: all requested models skipped because `PROPOSAL_PREMIUM_ROUTING_LIVE=1` was not set.

Live-route smoke harness with opt-in but without loading local credentials:

```bash
rtk env PROPOSAL_PREMIUM_ROUTING_LIVE=1 npx tsx scripts/evals/smoke-live-premium-routing.ts --models=mistral-medium-latest,mistral-large-latest,qwen3.7-max,chatgpt
```

Result:

- Mistral Medium skipped: `MISTRAL_API_KEY unset`
- Mistral Large skipped: `MISTRAL_API_KEY unset`
- Qwen skipped: `QWEN_API_KEY unset`
- OpenAI skipped: `OPENAI_API_KEY unset`

Harness unit tests:

```bash
rtk npx vitest run scripts/evals/__tests__/smoke-live-premium-routing.test.ts
```

Result: 7 tests passed.

Live no-DB provider smoke after user approved reading local app env files:

```bash
set -a
source .env
source .env.local
export PROPOSAL_PREMIUM_ROUTING_LIVE=1
export TMPDIR=/private/tmp
set +a
rtk npx tsx scripts/evals/smoke-live-premium-routing.ts --models=chatgpt,mistral-medium-latest,mistral-large-latest --require-premium-success
```

Result:

- OpenAI: assertion passed; `premium success`, `structured_saved`, metadata tags included `premium_cover_letter_path_v1` and `generation_path:premium_success`.
- Mistral Medium: assertion passed; `premium success`, `structured_saved`, metadata tags included `premium_cover_letter_path_v1` and `generation_path:premium_success`.
- Mistral Large: assertion passed after the Mistral repair prompt change; `premium success`, `structured_saved`, metadata tags included `premium_cover_letter_path_v1` and `generation_path:premium_success`.

Previous Mistral Large live smoke before the repair prompt hardening had entered premium, failed validation on `unsupported_ownership_verb`, and safely fell back to legacy. That failure is no longer the current asserted smoke result.

Qwen with the default gate state: credentials were present, but `ENABLE_COVER_LETTER_PREMIUM_PATH_V1` was not enabled, so Qwen stayed on `legacy-only path`.

Qwen gated live no-DB smoke:

```bash
set -a
source .env
source .env.local
export PROPOSAL_PREMIUM_ROUTING_LIVE=1
export ENABLE_COVER_LETTER_PREMIUM_PATH_V1=1
export TMPDIR=/private/tmp
set +a
rtk npx tsx scripts/evals/smoke-live-premium-routing.ts --models=qwen3.7-max --require-premium-success
```

Result: Qwen premium-success assertion passed. Qwen entered premium with `premiumFlagEnabled: true`, saved `premium success` / `structured_saved`, and metadata tags included `premium_cover_letter_path_v1`, `feature_flag:cover_letter_premium_path_v1`, and `generation_path:premium_success`.

Post duplicate-output fix live no-DB smokes:

```bash
set -a
source .env
source .env.local
export PROPOSAL_PREMIUM_ROUTING_LIVE=1
export TMPDIR=/private/tmp
set +a
rtk npx tsx scripts/evals/smoke-live-premium-routing.ts --models=mistral-medium-latest --require-premium-success
rtk npx tsx scripts/evals/smoke-live-premium-routing.ts --models=chatgpt --require-premium-success
```

Result: both Mistral Medium and OpenAI/GPT passed premium-success assertions after the duplicate-output finalization guard. Mistral Medium was re-run after the malformed-fragment guard and still passed premium success. Secret values were not printed.

Post live-quality audit fixes:

- Backend proposal style trace logging in `createProposalPublic` and `updateProposalPublic` is now gated behind `ENABLE_PROPOSAL_STYLE_TRACE`; normal metadata patches should no longer flood `[proposal-style-trace]` logs.
- Valid `cv_adjacent` premium writer output is no longer overwritten by the shared evidence-order normalizer. That normalizer remains a rescue path for invalid adjacent drafts, not the default winning path after validation.
- Evidence ranking now prioritizes candidate reporting/documentation/handoff evidence when the job work surface explicitly includes reporting, documentation, communication, handoff, or escalation. In the security canary brief, `topEvidence` now starts with the reporting fact instead of equipment-readiness support.
- Mistral premium body parts have a tighter compactness contract and a Mistral-only adjacent bridge repair for evidence-only `employerValueBlock` / detached close lines.

Security canary after these changes:

```bash
set -a
source .env
source .env.local
export TMPDIR=/private/tmp
set +a
rtk npx tsx scripts/evals/benchmark-cover-letter-writers.ts --cases=security-securitas-adt-copwatch --writers=mistral-medium-latest,gpt-5.5 --evaluator=gpt-5-mini
```

Result:

- GPT/OpenAI: `premiumReady=true`, `globalScore=4`.
- Mistral Medium: route and validation succeeded, `rankMatchesText=true`, but `premiumReady=false` with `globalScore=3` on the latest run. Main weakness was still lack of employer-facing specificity/persuasion. Do not claim Mistral Medium is fully fixed for this in-app security canary.

## Provider State

- OpenAI/GPT: mocked premium routing is green; live no-DB smoke reached premium success and saved premium-success metadata.
- Mistral Medium: mocked routing is green; live no-DB smoke reached premium Mistral success and saved premium-success metadata. The security canary still fails the premium-ready quality gate after routing and prompt/ranking fixes.
- Mistral Large: mocked routing is green; live no-DB smoke with `--require-premium-success` reached premium Mistral success and saved premium-success metadata.
- Qwen: mocked provider-specific routing is green; live no-DB smoke with the premium gate enabled reached premium success and saved premium-success metadata. With the default gate state, Qwen remains legacy.

## Live Verification Boundary

Before local env files were sourced, the process environment had no live provider credentials set:

- `OPENAI_API_KEY=unset`
- `MISTRAL_API_KEY=unset`
- `QWEN_API_KEY=unset`
- `QWEN_CHAT_COMPLETIONS_URL=unset`
- `QWEN_BASE_URL=unset`

After user approval to read local `.env` files, local app env loading showed:

- `OPENAI_API_KEY=set`
- `MISTRAL_API_KEY=set`
- `QWEN_API_KEY=set`
- `QWEN_CHAT_COMPLETIONS_URL=set`
- `QWEN_BASE_URL=unset`

Secret values were not printed. No `.env` file was modified. No DB or Docker operation was run.

To run the live no-DB route smoke from a shell that already has credentials in `process.env`:

```bash
PROPOSAL_PREMIUM_ROUTING_LIVE=1 rtk npx tsx scripts/evals/smoke-live-premium-routing.ts --models=chatgpt,mistral-medium-latest,mistral-large-latest --require-premium-success
```

The script does not call `dotenv`, does not read existing user CVs/jobs, and uses a synthetic in-memory Convex context.

## Remaining Risks

- Closing/sign-off flicker remains a separate frontend structured-closing priority issue; routing disclosure now helps prove whether the displayed document came from premium success, fallback, or UI mutation.
- A pasted Mistral Medium result that summarizes only the Securitas job description is not acceptable CV-backed output. If routing metadata shows candidate context was present, backend finalization should reject it; if metadata/source CV is absent, the UI generated a no-CV cover letter.
- `ENABLE_PROPOSAL_STRUCTURED_MISTRAL=all_cover_letters` should remain off until credentialed live routing and output quality are verified.
