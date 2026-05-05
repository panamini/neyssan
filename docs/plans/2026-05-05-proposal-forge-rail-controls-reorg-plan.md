# Proposal Forge rail controls reorg plan

## Context

The Proposal Forge rail currently has Source CV as its own section, Tone as standalone compact pills, Length as standalone pills, and Header details always visible. The requested update is to compact the rail further:

- Move Source CV selection into **Draft setup**.
- Move Tone selection into **Draft setup** and use only the existing dark dropdown/menu selector, not tone pills.
- Move Length into **Ask AI** as a small selector dropdown and hide character-count descriptions.
- Make **Header details** a collapsible panel with chevron, similar to Job context, not a menu dropdown.
- Audit why Short/Long appeared frozen and confirm they are connected to generation parameters.
- Provide a clear implementation diff/file-touch summary after changes.

## Findings

- Main rail component: `my-app/src/components/proposal/ProposalRail.tsx`.
  - Source CV is currently rendered as its own section before `Draft setup`.
  - `Draft setup` currently shows draft title plus a static CV/Tone summary list.
  - Tone pills are rendered in a standalone section using `toneOptions` and `ToneBadge`.
  - Length pills are rendered in a standalone section using `lengthOptions` and `onSelectLength`.
  - Ask AI is a standalone section after Length.
- Styling for these controls lives in `my-app/src/styles/product-proposal.css` around rail classes:
  - `.dasti-proposal-skeleton-rail__cv-button`
  - `.dasti-proposal-skeleton-rail__tone-pills`
  - `.dasti-proposal-skeleton-rail__length-pills`
  - `.dasti-proposal-skeleton-rail__draft-setup`
  - `.dasti-proposal-skeleton-rail__ask-field`
- Length state wiring is in `my-app/src/pages/ProposalForge.tsx`:
  - `proposalRailLengthOptions` maps Short/Medium/Long to selected states from `activeCharacterLimitSelection.value`.
  - `handleProposalRailLengthSelect()` writes `characterLimitMode: "custom"` and `characterLimitValue` to stored compose draft and `composePreviewValues`.
  - `ProposalInputForm` receives `externalCharacterLimitMode` / `externalCharacterLimitValue`, and generation submit payload persists `values.characterLimitMode` / `values.characterLimitValue`, so the control is intended to feed generation parameters.
- Likely cause of “Short/Long frozen”: current rail `handleProposalRailLengthSelect()` updates parent compose state, but the hidden/suppressed compose form may not be marked dirty/touched or may be overwritten by the form's external synchronization/defaults before submit in some flows. The implementation should preserve the parent state update but also verify the hidden form receives the external values and that the dropdown selected value reflects `draftCharacterLimitValue` immediately.

## Approach

1. Keep the existing `ProposalRail` prop wiring and generation state, but change the rail layout only.
2. Reuse existing `Menu` styling for Source CV, Tone, and Length dropdowns so dark mode keeps the white-on-black selected/menu look.
3. Remove the standalone Tone and Length pill sections from the rail DOM.
4. In `Draft setup`:
   - Keep Draft title.
   - Insert Source CV `Menu` button below/near Draft title.
   - Insert Tone `Menu` button using `toneOptions`, with the currently selected tone as trigger text.
   - Keep Generate button.
5. In `Ask AI`:
   - Add a compact Length dropdown in the section header/top row.
   - Options are Short / Medium / Long only; no character amount text in visible trigger or option labels.
   - Keep internal descriptions as optional `title`/accessible labels only if useful, not visible UI text.
6. Convert Header details section from a plain section to a `<details open>` panel:
   - Use `ChevronDown` icon in summary.
   - Match Job context collapsible behavior/pattern and existing rail tokens.
   - Keep fields in the panel body; do not use a dropdown menu.
7. Length freeze audit/fix:
   - Ensure the Length dropdown `onSelect` calls the same `handleProposalRailLengthSelect` path.
   - Ensure `handleProposalRailLengthSelect` updates stored compose draft, `composePreviewValues`, and any initial seed needed by `ProposalInputForm`.
   - Add or update a focused test/assertion if existing rail tests cover the workspace toolbar, to verify selecting Short/Long changes selected label/value.

## Files to modify

- `my-app/src/components/proposal/ProposalRail.tsx`
  - Reorganize control placement.
  - Replace Tone pills with a Tone `Menu` inside Draft setup.
  - Replace Length pills with a compact Length `Menu` in Ask AI.
  - Make Header details a collapsible details panel with chevron.
- `my-app/src/pages/ProposalForge.tsx`
  - Keep existing state mapping but audit/adjust `handleProposalRailLengthSelect` if needed so Short/Long selection is not overwritten and is included in generation.
  - Possibly simplify visible length labels passed to rail.
- `my-app/src/styles/product-proposal.css`
  - Remove/deprecate standalone tone/length pill layout rules as needed.
  - Add compact dropdown row styles for Draft setup and Ask AI.
  - Add collapsible Header details panel styles using existing tokens.
- `my-app/src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx` or a focused nearby test
  - Add/update assertions for new rail placement and length selection if practical.

## Reuse

- `Menu` component from `my-app/src/components/ui/menu.tsx` for dropdown behavior and dark selected styling.
- Existing `cvMenuSections` in `ProposalRail.tsx` for Source CV dropdown.
- Existing `toneOptions` / `onSelectTone` props in `ProposalRail.tsx` for Tone dropdown.
- Existing `lengthOptions` / `onSelectLength` props in `ProposalRail.tsx` for Length dropdown.
- Existing `ChevronDown` from `my-app/src/lib/icons.tsx` for collapsible header details.
- Existing generation character limit mapping in `ProposalForge.tsx` and `ProposalInputForm.tsx` external character-limit sync.

## Steps

- [ ] Update `ProposalRail.tsx` to move Source CV and Tone controls into Draft setup.
- [ ] Remove standalone Tone pill section.
- [ ] Move Length into Ask AI header/top row as a compact dropdown.
- [ ] Remove visible character amount copy from Length controls.
- [ ] Make Header details a collapsible `<details open>` panel with chevron and panel body.
- [ ] Audit/fix Short/Long selection path so selected value updates immediately and feeds generation payload.
- [ ] Update CSS in `product-proposal.css` using existing DASTI spacing/color tokens only.
- [ ] Update focused tests if existing assertions expect standalone Source CV/Tone/Length sections.
- [ ] Prepare a final diff summary listing touched files and exact behavior changes.

## Verification

- `rtk sh -lc 'cd my-app && pnpm exec tsc --noEmit'`
- `rtk sh -lc 'cd my-app && pnpm exec stylelint src/styles/product-proposal.css --allow-empty-input'`
- `rtk sh -lc 'cd my-app && pnpm test -- --run src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx'`
- Manual/visual check in Proposal Forge:
  - Source CV and Tone appear inside Draft setup.
  - No Tone pill section remains.
  - Length dropdown appears in Ask AI and selection changes among Short/Medium/Long.
  - Generation receives the selected length.
  - Header details expands/collapses with chevron and is not a dropdown menu.
