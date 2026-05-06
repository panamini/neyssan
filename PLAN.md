# Proposal Forge style tab clone

## Context
The CV Forge rail has a `Sections / Ask / Style` tab set, and the user wants the same `Style` tab pattern in Proposal Forge. The active Proposal Forge rail is `my-app/src/components/proposal/ProposalRail.tsx`; it currently owns a local `"draft" | "ask" | "header"` tab state and is rendered from `my-app/src/pages/ProposalForge.tsx`.

The new tab should match the CV Forge visual language, but it must be proposal-scoped: it must update proposal style/render state and persistence, not CV settings or CV metadata. The active Proposal Forge styling surface is workshop-only; legacy template labels should not be shown in the proposal rail.

## Architecture goals
- Reproduce the CV rail style-tab layout pattern in Proposal Forge: note/link row, a workshop-only style preset selector (Style 1–3), font-pair selector, and accent/color selector.
- Use proposal-specific option sources and identifiers, but keep the style content aligned with the shared Verbati/CV palette system. Do **not** reuse CV-only accent ids as proposal state values, and do **not** keep the older proposal-local palette list.
- Avoid two divergent proposal style UIs. Proposal Forge already renders style controls through `EmbeddedStyleInspector` in `ProposalDocumentStage`; the new rail panel must either replace that visible control or share a single proposal style-control component/state path so both entry points cannot drift.
- Keep style updates in the existing Proposal Forge style pipeline so preview, local output draft, saved proposals, and export/print use the same resolved style/template, and verify that style changes remain isolated to the active proposal.

## Active files and references
### Expected active files to change
- `my-app/src/components/proposal/ProposalRail.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/styles/product-proposal.css`
- Tests under `my-app/src/pages/__tests__/` and/or `my-app/src/lib/__tests__/`

### Change only if the review/implementation discovers a real persistence or type gap
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/proposal-render-state.ts`
- `my-app/src/lib/proposal-template-bundles.ts`
- `my-app/src/features/verbati/style.ts`
- `my-app/src/features/verbati/styleBundles.ts`
- `my-app/src/lib/proposal-style-display.ts`

### Read-only references
- `my-app/src/components/cv/CvRail.tsx`
- `my-app/src/styles/product-cv.css`
- `my-app/src/components/EmbeddedStyleInspector.tsx`
- Existing Proposal Forge style handlers in `my-app/src/pages/ProposalForge.tsx`

## Existing state/handler facts to preserve
- `ProposalRail` currently has a local tab union of `"draft" | "ask" | "header"`; extend that union to include `"style"` rather than assuming CV Forge's controlled `activeTab` API.
- Proposal Forge already has direct style handlers that should be reused or wrapped:
  - `handleProposalStyleBundleSelect`
  - `handleProposalTypographySelect`
  - `handleProposalPaletteSelect`
  - `handleProposalCustomAccentSelect`
- A proposal style change must keep these pieces coherent where applicable:
  - `proposalStyleLinkMode` should become `"proposal_local"` so edits detach from CV inheritance.
  - `proposalTemplateBundleId`
  - `proposalTemplateId`
  - `proposalStylePreset`
  - `proposalWorkspaceStyle`
  - `hasUserEditedStyle`
  - `proposalStyleChoice`
  - `proposalPaletteOverride`
  - `proposalCustomAccentHex`
- The render source of truth is the resolved proposal style/template used by `ProposalDisplay`, `ProposalDocumentStage`, local draft metadata, saved proposal metadata, and export/print.

## Option sources
- Template/style bundles: workshop-only style presets for Proposal Forge. The template itself stays fixed to `workshop`, while the rail exposes three numbered style presets (`Style 1`–`Style 3`) aligned with Settings → Document style.
- Font pair/typography: valid `VerbatiTypographyPreset` / `VerbatiFontPairId` values resolved through the existing Verbati style/font helpers; do not emit ids that `resolveVerbatiStyle` or output-draft parsing cannot rehydrate.
- Accent palettes: shared `VERBATI_PALETTE_OPTIONS` from `my-app/src/features/verbati/style.ts` / `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx` (`sauge`, `ocre`, `pierre`, `bordeaux`, `encre`) plus the dedicated seventh tone that opens the custom color picker through `customAccentHex` / `palette: "custom"`.
- Proposal Forge should not surface the older proposal-local palette list or CV-only accent ids as stored proposal values.

## Implementation steps
- [x] Add a `Style` tab to `ProposalRail` alongside `Draft`, `Ask`, and `Heading` by extending its local tab union and tab list to `"draft" | "ask" | "header" | "style"`.
- [x] Add typed `ProposalRail` props for current proposal style/template/palette state and callbacks. Prefer passing already-existing Proposal Forge handlers rather than creating a separate state path.
- [x] Render a CV-style proposal rail panel in the `Style` tab: workshop-only note/link, numbered style-preset selector (`Style 1`–`Style 3`), font-pair selector, and accent/color selector.
- [x] Use proposal-scoped selector values: workshop template only, numbered style presets, valid proposal typography/font ids, shared Verbati/CV palettes, and the custom-color seventh tone. Never store legacy proposal palette ids or CV-only accent ids in proposal state.
- [x] Wire each selector to the Proposal Forge direct style pipeline so preview updates immediately and changing any style control detaches the proposal from CV inheritance without mutating the attached CV.
- [x] Resolve the existing `EmbeddedStyleInspector` placement deliberately: replace it with the rail tab control or extract/share a proposal style-controls component so duplicate controls remain visually and behaviorally consistent.
- [x] Ensure style persistence uses the existing output-draft/saved-proposal flow: `verbatiStyle` / `proposalVerbatiStyle`, `templateId`, `styleLinkMode`, `templateBundleId`, `paletteOverride`, `customAccentHex`, and `typographyOverride` must round-trip consistently after reload and after opening a saved proposal.
- [x] Verify and document that autosave/save-to-library persistence is per-proposal, not global: changing style in one proposal must not leak into another proposal after switching drafts or reopening saved proposals.
- [ ] If pre-generation style selections are expected to survive reload before any proposal content exists, add or adapt a style-only compose-draft persistence path; otherwise document and test the exact boundary where persistence begins.
- [x] Mirror CV Forge styling in `product-proposal.css` with proposal-scoped classes or shared neutral classes. Do not couple Proposal Forge markup to `dasti-cv-*` selectors.
- [x] Add/update tests for tab visibility, accessible tab behavior, numbered style preset behavior, shared palette behavior, custom-color seventh-tone behavior, detached-CV inheritance behavior, per-proposal autosave isolation, local draft round-trip persistence, saved-proposal reopen persistence, and export/print style parity.

## Verification
- Run targeted Proposal Forge/page tests and proposal style/output-draft tests.
- Verify the `Style` tab visually matches the CV Forge style-tab pattern while using proposal class names and numbered proposal style labels `Style 1`–`Style 3`.
- Confirm selecting the workshop style preset, font pair, shared palette, and custom-color seventh tone updates the proposal preview immediately.
- Confirm style selections survive reload through the intended draft persistence path.
- Confirm switching between proposals does not leak style state between drafts or saved proposals.
- Confirm saving to the library and reopening the saved proposal preserves style, font, and palette.
- Confirm styled PDF/export source receives the same resolved `stylePreset` and `templateId` as the preview.
- Confirm changing Proposal Forge style while a CV is attached does not mutate CV style metadata and switches the proposal to local style mode.
