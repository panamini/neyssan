# Premium Cv Adjacent Stability And Preset Tuning Audit

Date: 2026-03-17

## Scope

- premium `cover_letter` only
- `gpt-5.4` only
- parser/output-shape verification on the previously flaky `cv_adjacent` family
- narrow preset-expression refinement only after stability verification

## Findings

- Active code: all premium presets still share the same runtime writer path through `generatePremiumCoverLetterBodyPartsWithOpenAI(...)` in `convex/lib/proposals/premiumCoverLetter.ts`.
- Active code: the premium SDK path is using `responses.parse(...)` with `zodTextFormat(...)`, and a targeted live check returned `output_parsed` with the expected four body-part keys.
- Live verification: the previously flaky adjacent family no longer reproduced parse/fallback failures in the checked runs.
  - Strong adjacent case (`strong-adjacent-honest-transfer`): `signature`, `expert`, and `engaging` each succeeded `3/3` on the premium structured path.
  - All successful runs returned `contextClass: "cv_adjacent"` and `mode: "transfer"`.
- Remaining quality issue after runtime stabilization: premium preset separation was still too weak.
  - Before this patch, the premium prompt carried the preset only inside the JSON brief and did not give the model explicit preset-specific rhetorical guidance.
  - That made `signature` especially likely to converge toward a slightly softer `expert`.

## Classification

- Runtime verification: `no meaningful parser/output-shape issue found` on the checked `cv_adjacent` family
- Quality issue found: `preset-expression issue`
- Layer: `prompt/body-contract issue`, not routing, parsing, or evidence hierarchy

## Change

- Added one shared premium prompt line that makes tone scope explicit:
  - preset affects rhetorical texture only
  - it must not change truthfulness, claim strength, or evidence priority
- Added one compact preset-specific guidance line for each supported premium preset:
  - `signature`: professional, warm, personal, concise, stable; direct first-person professional positioning; one grounded employer-facing relevance sentence when material exists; avoid colder expert analysis and minimal shell phrasing
  - `expert`: compact, professional, controlled; one measured analytical sentence about workflow, demands, or operating context when supported
  - `engaging`: warmer but restrained; one grounded team/stakeholder/service sentence when supported, still concrete

## Validation

- `npm test -- premiumCoverLetter.test.ts`
  - result: `24/24` tests passed
- Live premium verification:
  - repeated `cv_adjacent` runs succeeded for `signature`, `expert`, and `engaging`
  - one direct SDK parse check confirmed `output_parsed: true`
- Post-change live spot checks:
  - `strong-signature`
  - `strong-expert`
  - `strong-engaging`
  - `weak-signature`
  all succeeded on the premium structured path

## Recommendation

- Keep this change.
- The parser-boundary fix appears to hold on the checked adjacent family, so the right next move was a narrow preset-expression refinement rather than more runtime salvage.
- If another premium quality issue remains, inspect `engaging` next. `signature` is now more distinctly first-person and warm-professional, while `expert` remains the more analytical option.
