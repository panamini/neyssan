# Premium Cover Letter Tone And Extension Wiring Audit

Date: 2026-03-16

## Scope

- premium `cover_letter` only
- `gpt-5.4` only
- tone preset / UI truthfulness
- Chrome extension -> premium pipeline wiring

## Findings

### Audit A: tone presets / UI truthfulness

- Active premium support is narrower than the app-level preset catalog.
- The shared preset catalog still defines five presets: `signature`, `expert`, `direct`, `engaging`, `storyteller`.
- The premium cover-letter path only supports three presets: `signature`, `expert`, `engaging`.
- The premium eligibility gate rejects unsupported presets with `preset_not_supported`.
- Proposal Forge still renders all shared presets in the main voice preset control for cover letters, including `direct` and `storyteller`.
- Therefore the current premium cover-letter UI is not fully truthful: it implies five preset choices apply to the premium path, while two of them are legacy/non-premium for this product path.

Evidence:
- `convex/lib/proposals/voicePresets.ts`
- `convex/lib/proposals/premiumCoverLetter.ts`
- `src/components/ProposalInputForm.tsx`

### Audit A: preset-expression quality

- Within the premium path itself, the three supported presets are meaningfully distinct enough for the current product contract.
- `signature` is the stable default and already reads as the premium baseline contractually: balanced, natural, credible, warm-professional, and not thin.
- `expert` is more formal, precise, and restrained.
- `engaging` is warmer and more interpersonal, but still bounded.
- I did not find evidence that premium tone changes truthfulness, claim strength, or evidence hierarchy by design. The stronger issue is exposure of unsupported presets, not the expression of the supported three.

### Audit B: Chrome extension -> premium pipeline wiring

- The extension has two materially different entrypoints:
  - direct extension generation
  - open-in-Proposal-Forge handoff
- Both preserve the scraped job description text.
- The open-in-Proposal-Forge handoff is correctly wired into the current app flow. It stores `jobTitle` and `jobDescription` in `proposalHandoffs`, Proposal Forge reads that handoff, and the form prefills the same `jobDescription` field that the premium backend consumes.
- The direct extension generation path calls the same backend `generateProposal` action, but defaults `modelType` to `mistral-small-latest`.
- Because the premium cover-letter path only activates when `requestedModelType === "chatgpt"` and `outputFormat === "cover_letter"`, the extension's direct-generate button does not reach the premium `gpt-5.4` path by default.
- I did not find model-selection UI in the current extension content UI that would let the user switch that direct path to `chatgpt`.
- Therefore the extension is connected to the premium pipeline only through the Proposal Forge handoff path, not through its default direct-generate path.

Evidence:
- `clerk-chrome-extension-final/src/background/index.ts`
- `clerk-chrome-extension-final/src/contents/content.tsx`
- `convex/proposalHandoffs.ts`
- `src/pages/ProposalForge.tsx`
- `src/components/ProposalInputForm.tsx`
- `convex/generateProposalMutation.ts`

## Classification

- Audit A: `UI truthfulness issue` with a secondary `legacy/premium preset mismatch`
- Audit B: `premium-path entrypoint mismatch`

## Recommendation

- Keep the premium architecture intact.
- Treat the main issue in Audit A as a narrow UI truthfulness fix: the premium cover-letter UI should expose only `signature`, `expert`, and `engaging`, or otherwise clearly mark `direct` and `storyteller` as non-premium/non-ChatGPT presets.
- Treat the main issue in Audit B as a narrow entrypoint truthfulness fix: if the product intends the extension to generate premium ChatGPT cover letters directly, its direct-generate request must explicitly select `chatgpt`; otherwise the UI should truthfully position premium generation as the Proposal Forge path.
