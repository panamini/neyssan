# Application Message Path And Candidate Evidence Audit

Date: 2026-03-17
Scope: `application_message` only, ChatGPT path first

## Findings

- The active ChatGPT `application_message` branch is still the inline prompt path in `handleGenerateProposal(...)`; it does not call `ProposalService.generateCreativeProposal(...)` for this mode.
- The confusing `attemptedPath: legacy-only path` signal was still reachable for `application_message` fail-closed errors because `attemptedGenerationPath` defaulted to `"legacy-only path"` for every non-cover-letter route.
- Candidate-side contamination was still possible before prompt assembly because `sanitizePersonalizationContext(...)` only clamped and deduped text. It did not remove employer-requirement phrasing such as year ranges, requirement language, or environment phrases.
- That meant requirement-like snippets could survive into the `Application-message candidate priority snapshot`, even after the earlier narrowing from the generic personalization block.

## Narrow fix

- Added an `application_message`-specific personalization sanitizer that drops requirement-style snippets before they become candidate-side usable evidence.
- The filter is intentionally narrow: year-range claims like `0-3 years` / `1+ years`, requirement/qualification phrasing, and the reviewed environment phrases (`customer-facing environments`, `retail/apparel`) are removed from app-message candidate evidence.
- The app-message path now records a truthful attempted-path label: `application-message inline path`.

## Validation

- Focused tests passed:

```bash
npx vitest run convex/lib/proposals/__tests__/proposalProviderBusy.test.ts convex/lib/proposals/__tests__/proposalWriterPrompt.test.ts convex/lib/proposals/__tests__/proposalRenderer.test.ts
```

- Result: `138` tests passed.
