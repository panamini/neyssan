# Proposal Controls Audit

Date: 2026-03-28

Scope:
- Feature Block A: tone tuning on regenerate
- Feature Block B: character limit control
- Feature Block C: plain text output mode
- Feature Block F: proposal style toolbar
- Audit-only groundwork for Blocks D and E

## Active Code

- `src/pages/ProposalForge.tsx`
  Owns compose-page state, the existing regenerate action, output display state, and proposal draft persistence.
- `src/components/ProposalInputForm.tsx`
  Owns the initial generate submit flow and compose-side field state.
- `src/components/ProposalDisplay.tsx`
  Owns rendered proposal preview, copy actions, editable mode, and the plain string derived from proposal content.
- `convex/generateProposalMutation.ts`
  Active server-side proposal generation entrypoint. This is where prompt routing, planner use, fallback handling, and provider selection are wired.
- `convex/lib/proposals/voicePresets.ts`
  Active tone preset authority.
- `convex/lib/proposals/proposalPlanner.ts`
  Active planning prompt for writer constraints and proof boundaries.
- `convex/lib/proposals/proposalBodyComposer.ts`
  Active structured cover-letter body prompt builder.
- `convex/lib/proposals/proposalContentPlan.ts`
  Active structured cover-letter content-plan prompt builder.
- `convex/lib/proposals/premiumCoverLetter.ts`
  Active premium ChatGPT cover-letter path.
- `src/styles/foundation.css`, `src/styles/primitives.css`, `src/styles/product.css`
  Active design-token and primitive-class sources.
- `src/features/verbati/style.ts`
  Active proposal/CV style bridge for template, palette, typography, and layout pairings.

## Legacy But Informative

- `src/components/ProfileEditorUnified.tsx`
  Informative for older CV editing flows, but it does not appear to be the primary active editor surface compared with `ProfileReviewCard.tsx` plus `SectionEditor.tsx`.
- `convex/mutations/refineField.ts`
  Active on the server, but not yet fully surfaced across the current CV editing UI. It is informative for Block E because it already establishes the confirm-before-apply AI mutation pattern.

## Obsolete Or Non-Authoritative

- `pdf-ingest/`
- legacy spaCy / training-oriented parser code
- backup and archive trees
- `*.bak` files

These were treated as non-authoritative per project instructions and were not used for implementation decisions.

## Findings

### Regenerate Flow

- The regenerate button is owned by `src/pages/ProposalForge.tsx`.
- Initial generation is submitted from `src/components/ProposalInputForm.tsx`.
- The safest implementation point for tone tuning is the shared `FormValues` request object, because `ProposalForge` already reuses the last submitted form payload for regeneration.

### Tone Presets Versus Tuning

- Existing presets already cover broad voice modes:
  - `signature` => balanced
  - `expert` => formal
  - `engaging` => warm
- The new tuning concept overlaps semantically with those presets, but replacing the preset would collapse two controls into one.
- The correct implementation is additive tuning layered on top of the selected preset. This preserves the current preset system and matches the requested behavior.

### Output Length Control

- Length was previously controlled only indirectly in prompts, mainly with soft word-count guidance in the legacy inline writer path.
- `convex/langchain/models/gpt4_adapter.ts` exposes `maxTokens`, but that is token-based and not a reliable character ceiling.
- Character limits therefore need to be expressed explicitly in prompt text, while the UI separately reports the actual rendered character count.

### Plain Text Accessibility

- The raw proposal body is already accessible as a string.
- `src/components/ProposalDisplay.tsx` already had the right normalization seam via `getDisplayedProposalText`, making plain-text mode low-risk to add without changing storage or rendering internals.

### Style System

- The proposal renderer already supports live visual changes through template ids plus Verbati style presets.
- The existing palette system in `src/styles/foundation.css` / `src/styles/themes.css` and the Verbati style bridge are the correct implementation surfaces.
- No regeneration is required for style switching.

### Editor Reuse Groundwork For Blocks D/E

- `src/components/SectionEditor.tsx` has access to Remirror state and selection objects, so a floating selection toolbar is technically feasible in the active editor path.
- `src/components/ProfileReviewCard.tsx` is the more relevant active CV review/edit surface than legacy unified editor code.
- `convex/lib/schemas/profileStrict.schema.ts` does not fully match all legacy profile fields, especially around summary handling, so Block E will need careful schema-aware implementation instead of assuming older fields are authoritative.
