# Extension And Proposal Forge Personalization/Display Audit

Date: 2026-03-12

## Scope

- Audit only.
- No behavior changes.
- Evaluate whether the remaining differences between direct extension generation and Proposal Forge should stay intentional or be lightly aligned.

## Active Code

### Personalization behavior

- `clerk-chrome-extension-final/src/background/index.ts`
  - Direct extension generation uses `proposalType: "cover_letter"` by default.
  - It still forces `personalizationMode: "explicit_only"`.
  - When current CV context is enabled, it sends the active CV snapshot context but still keeps `explicit_only`.
- `my-app/src/components/ProposalInputForm.tsx`
  - Proposal Forge sends `personalizationContext` and `personalizationRichness`.
  - It does not force `personalizationMode: "explicit_only"`.
- `my-app/convex/generateProposalMutation.ts`
  - `explicit_only` uses only the explicit client context.
  - Default behavior can merge explicit context with fallback profile context depending on richness.
  - Richness also affects prompt-strength guidance.

### Display behavior

- `clerk-chrome-extension-final/src/contents/content.tsx`
  - The extension shows generated output in a raw editable textarea.
- `my-app/src/components/ProposalDisplay.tsx`
  - Proposal Forge renders `cover_letter` and `application_message` outputs as letter-style paragraphs.

## Conclusions

### What should intentionally remain different

- Proposal Forge should remain the richer personalization workspace.
- The extension should remain lightweight and one-click.
- Keeping `personalizationMode: "explicit_only"` in the extension is still a healthy product separation for now:
  - it keeps extension output predictable against the active CV only
  - it avoids hidden fallback merges the user cannot inspect from the extension UI
  - it avoids changing generation semantics in a surface that is meant to stay simple

### What is still hurting coherence

- The extension's raw textarea display now understates output quality relative to Proposal Forge.
- Even when content intent is aligned, Proposal Forge feels more polished because its letter-like display matches the output type.
- This is now a perception issue more than a generation-plumbing issue.

## Smallest Safe Next Step

- If any next change is made, it should be display-only, not personalization-logic alignment.
- The smallest safe move is:
  - keep extension generation contract as-is
  - keep `explicit_only`
  - render cover-letter/application-message outputs in a minimal letter-style preview instead of raw textarea-only display
  - preserve copy/save actions and lightweight behavior

## What Should Stay Unchanged For Now

- Auth/session flow
- Scraping
- Current-CV sync
- Backend tone baseline
- Model defaults
- Proposal Forge controls
- Any fallback-merge personalization logic inside the extension
