# Premium No-CV Offer-Priority And Extension Wiring Audit

Date: 2026-03-16

## Scope

- premium `cover_letter` only
- premium no-CV only
- employer-side job-offer prioritization connectivity
- Chrome extension no-CV wiring

## Findings

### Audit A: premium no-CV offer-priority connectivity

- No meaningful issue found.
- Premium no-CV generation does use the current employer-side prioritization helper in `convex/lib/proposals/premiumCoverLetter.ts`.
- `inferPremiumCoverLetterContextClass(...)` now classifies no-CV requests through `buildJobOfferPriorityPack(jobDescription)` when no CV facts exist.
- `rankAllowedFacts(...)` still uses `buildJobOfferPriorityPack(jobDescription)` to build priority tokens, and in `no_cv` mode it derives `strongestEvidence` and `supportingEvidence` from `job_post` facts rather than from a legacy/no-context path.
- `buildPremiumCoverLetterBrief(...)` uses the same structured employer-side fields as the CV-backed premium path:
  - `topResponsibilities`
  - `keyRequirements`
  - `preferredQualifications`
  - `lowValueChecklist`
  - `workContext`
- `buildPremiumCoverLetterPrompt(...)` explicitly tells the writer that in `no_cv`, `topEvidence` and `supportEvidence` are employer-side work surfaces and priorities from the job offer, not candidate history.

Conclusion:
- premium no-CV is connected to the current offer-priority logic
- it does not bypass the newer employer-side hierarchy

### Audit B: Chrome extension no-CV wiring

- The extension still has a no-CV option in the current UI, expressed as the `Use current CV context` checkbox.
- When that box is unchecked, the direct extension generation path sends `personalizationMode = "explicit_only"` to the backend and does preserve `jobTitle` and `jobDescription`.
- However, the direct extension path still defaults `modelType` to `mistral-small-latest` in the background handler.
- The current extension content UI does not expose a model selector and its local `JobData` type does not include `modelType` or `voicePreset`, so the direct extension no-CV flow does not request premium ChatGPT no-CV generation.
- The extension handoff path (`Open in Proposal Forge`) only stores `jobTitle`, `jobDescription`, `sourceUrl`, and `platform`. It does not preserve no-CV intent, requested model, or tone preset.
- Once the handoff opens Proposal Forge, generation uses whatever active CV state and model choice exist in the web app, so the handoff path is not a guaranteed premium no-CV path either.

Conclusion:
- direct extension no-CV -> legacy/non-premium by default
- open-in-app handoff -> ambiguous and state-dependent
- extension no-CV is not truthfully aligned with the premium no-CV path now available in the app

## Classification

- Audit A: `no meaningful issue found`
- Audit B: `extension premium-path entrypoint mismatch` with secondary `request-shape mismatch`

## Recommendation

- Keep the premium no-CV implementation as-is on the app/backend side.
- Treat the remaining issue as extension-side truthfulness/wiring:
  - direct extension no-CV does not activate premium because it does not request `chatgpt`
  - open-in-app handoff does not preserve no-CV intent or premium generation settings
- Do not redesign routing. If this is addressed later, the narrow fix should be at the extension request-shape / entrypoint layer.
