# Proposal Forge style rail follow-up plan

## User-reported issues
- The custom palette icon in Proposal Forge rail is too small; the color wheel should fill the whole circular swatch.
- The rail custom tone currently uses a hidden native `<input type="color">` instead of the existing Proposal Forge custom color picker.
- Changing style/color/font pair should persist to the active proposal immediately. Reopening from Proposal Library should show the new style without regenerating, asking AI, opening the toolbar, or editing text.
- Saving/reopening must preserve the proposal's attached job context. Loading a proposal from the library should still show the job title/description/source context that was used to create it.
- Saving to library must not route the user into the old saved-proposal display shell if that shell is no longer part of the product direction. Saved and draft proposals should open inside Proposal Forge unless the product explicitly keeps the old library detail page.

## Fresh-eyes audit findings

### 1. Custom picker UI boundary
Active code: `my-app/src/components/proposal/ProposalRail.tsx`.

Current rail implementation renders the seventh custom tone as a `<label>` with a hidden native `<input type="color">`. This bypasses the app picker and is the direct cause of the unstyled native picker behavior.

Existing app picker code is active and already used by proposal toolbar-era components:
- `my-app/src/components/ProposalColorPickerPopover.tsx`
- `my-app/src/components/ProposalArtifactInspector.tsx`
- `my-app/src/components/SavedProposalForgeToolbarPreview.tsx`

The rail should reuse `ProposalColorPickerPopover` with refs/controlled open state, not a native color input.

Important implementation details discovered while reading the picker:
- `ProposalColorPickerPopover` portals to `document.body`, so component tests must query the document-level dialog.
- Its `currentHex={null}` fallback is `#556D60`, not the requested muted custom starter color. The rail should pass a deliberate muted starter hex when opening the picker before a custom color is selected.
- Its attached-surface auto-detection does **not** include `.dasti-proposal-skeleton-rail`; either pass an explicit `surfaceAnchorRef` to the swatch group/rail section or add the rail selector deliberately. Prefer explicit `surfaceAnchorRef` for the smallest scoped change.
- Existing toolbar behavior exposes a clear action when a custom color is active. To avoid a half-clone, the rail plan should include a clear/reset path too, not just color selection. Important: `ProposalColorPickerPopover` shows the clear footer whenever `onClear` is provided, so the rail should pass `onClear` only when the seventh custom tone is actually selected, not while the muted starter color is merely seeding the picker and not while a fixed-hex swatch such as Terre/Ink/Cobalt/Plum is selected.

### 2. Icon sizing boundary
Active code: `my-app/src/styles/product-proposal.css`.

Current custom icon CSS sets `.dasti-proposal-skeleton-rail__style-swatch-wheel` to `17px` inside a `26px` swatch, so the wheel looks too small. The toolbar pattern uses a wheel class that fills the swatch surface. The rail should make the SVG fill the circle (`width: 100%; height: 100%`) while keeping any desired optical inset on the button itself, not by shrinking the SVG.

### 3. Style save/reopen boundary
Active code: `my-app/src/pages/ProposalForge.tsx`.

The intended path is:
1. Rail callback (`onSelectStyleBundle`, `onSelectStyleTypography`, `onSelectStylePalette`, `onSelectStyleCustomAccent`).
2. Proposal Forge handler updates proposal-local style state and sets `proposalStyleLinkMode = "proposal_local"`.
3. `proposalRenderMetadata` includes `templateId`, serialized `verbatiStyle`, `styleLinkMode`, `styleChoice`, optional `templateBundleId`.
4. `proposalPersistenceMetadata` is copied into `buildComposeSaveSnapshot()`.
5. Autosave or save-to-library calls `updateProposal/createProposal` with that metadata.
6. Saved view rehydrates through `openedSavedProposal.metadata` and `resolveProposalRenderState()`.

Risks found:
- `handleProposalPaletteSelect` and `handleProposalCustomAccentSelect` set `proposalPaletteOverride` / `proposalCustomAccentHex`, then call `applyProposalDirectStyle()`, which immediately clears those side-channel fields. The serialized `verbatiStyle` still carries the chosen color, but the side-channel fields are not reliable after rail edits.
- Current rail code uses the same `onSelectStyleCustomAccent(hex)` callback for fixed hex swatches (Terre/Ink/Cobalt/Plum) and the seventh custom picker. The page cannot distinguish those sources, so it can incorrectly treat a fixed design swatch as the user-custom tone. The fix needs either separate callbacks or a source argument.
- `applyProposalDirectStyle()` currently clears `proposalTemplateBundleId`. That may be fine for arbitrary direct edits, but the plan must distinguish **base style selection** from **font/color override**. Blindly preserving `templateBundleId` for all direct edits can be confusing because `selectedProposalBundleDefinition` is a separate base-style mechanism.
- `buildComposeSaveSnapshot()` reads React state from the current render. If a user changes style and immediately clicks Save to Library before React has committed the next render, the forced save can still build a snapshot from the previous style. The implementation needs a synchronous latest-style commit/ref, not only normal state updates.
- Existing `ProposalForge.autosave.test.tsx` contains an `EmbeddedStyleInspector` mock, but current `ProposalForge.tsx` no longer renders that inspector (`styleControl={null}`). That mock is stale; tests must exercise the rail path or expose rail callbacks through a focused mock.
- The loaded-draft path currently writes output-draft helper fields (`paletteOverride`, `customAccentHex`, `templateBundleId`) from the current page state, not from the draft proposal metadata being loaded. That can preserve stale helpers across draft switches even if the authoritative `verbatiStyle` is different.
- Saved-view style resolution currently includes component state such as `savedProposalStylePreset` before the restore effect runs. When switching saved proposals, that state can briefly carry the previous saved proposal's style. Saved-view render should be keyed to or derived from the selected saved row metadata so previous saved-state cannot win over `openedSavedProposal.metadata`.
- Job context is not currently part of the same authoritative snapshot thinking as style. `proposalPersistenceMetadata` preserves `sourceJobDescription`, `sourceUrl`, `platform`, and `jobId`, but the rail/workbench job context is mainly derived from compose draft state (`composePreviewValues`, `outputSourceComposeDraft`, stored compose draft, canonical job) rather than from the opened saved/draft proposal metadata. After Save to Library clears compose/output drafts, reopening a saved proposal can therefore lose the attached job context even though the saved row still carries partial source metadata.
- Type/API mismatch to resolve during implementation: `ProposalDocumentMetadata` explicitly types `sourceJobDescription`, `sourceUrl`, and `platform`, but the current save path also writes/reads `jobId` and the new reopen requirement needs a reliable source job title. The plan should require adding/normalizing explicit metadata fields such as `jobId?: string` and, if no existing canonical-job title is available, `sourceJobTitle?: string`, rather than relying on untyped ad hoc metadata or the document title.
- The current `/proposal?view=saved&id=...` branch renders `ProposalsList`, which is the older saved-proposal display shell. If the intended product direction is “all saved and draft proposal documents open in Proposal Forge,” the plan must not treat that shell as the target reopen experience. At most it should remain a compatibility/overview route that redirects or selects a document into the Forge workbench.

## Architectural goal for the fix
Use `verbatiStyle + templateId + styleLinkMode` as the authoritative persisted style snapshot. Treat `templateBundleId`, `paletteOverride`, `customAccentHex`, and typography/layout override fields as UI/restoration helpers only. They must not be required for saved-view correctness, and they must not be able to replay over a freshly selected font/color.

Use saved-row proposal metadata as the authoritative job-context snapshot for saved/draft reopen. Source fields such as `sourceJobDescription`, `sourceUrl`, `platform`, `jobId`, and any explicit source title/title fallback must survive Save to Library, draft reload, and library reopen independently of local compose-draft storage. Do not rely on `writeStoredProposalComposeDraft()` or local output draft state for saved-row job context correctness.

## Fix plan

### Phase 1 — Replace native rail picker with existing popover
- Update `my-app/src/components/proposal/ProposalRail.tsx`:
  - Import `ProposalColorPickerPopover` from the sibling components folder (`../ProposalColorPickerPopover`).
  - Add `customColorAnchorRef`, `customColorSurfaceRef`, and `isCustomColorPickerOpen` local state.
  - Render the custom tone as a `<button type="button">`, not a `<label>` and not any `<input type="color">`.
  - Attach `customColorAnchorRef` to the custom swatch button.
  - Attach `customColorSurfaceRef` to the swatch group or style section and pass it as `surfaceAnchorRef` so the popover positions relative to the rail without requiring a broad picker selector change.
  - On click, open `ProposalColorPickerPopover` anchored to the custom swatch.
  - Close the popover when the user leaves the `Style` tab, chooses any non-custom style/accent/font control, or the style section unmounts. Do not leave `isCustomColorPickerOpen=true` to surprise-open when returning to the tab.
  - Compute `isSeventhCustomToneSelected` separately from generic `stylePreset.palette === "custom"`: it should be true only when the style has a valid custom `accentHex` that does **not** match one of the fixed hex swatches. Normalize both sides when comparing because persisted custom accents are sanitized/lowercased by `normalizeVerbatiAccentHex()` while the rail constants may be uppercase.
  - Pass `currentHex={isSeventhCustomToneSelected ? customAccentColor : CUSTOM_TONE_INITIAL_HEX}` where `CUSTOM_TONE_INITIAL_HEX` is the same muted/dimmed starter used for the unselected custom swatch (currently planned as `#8A8176`, unless the design token defines a better muted custom color). This prevents a fixed-hex swatch like Cobalt from seeding the seventh custom picker as if it were a user custom tone.
  - Split the rail accent callbacks so fixed hex swatches and the seventh custom picker are distinguishable, for example:
    - `onSelectStyleFixedAccent(hex)` for Terre/Ink/Cobalt/Plum fixed design swatches.
    - `onSelectStyleCustomAccent(hex)` only for `ProposalColorPickerPopover.onHexChange` from the seventh custom picker.
    - Alternatively pass a second source argument, but do not leave both sources sharing an indistinguishable single-hex callback.
  - Wire `ProposalColorPickerPopover.onHexChange` to the true seventh-custom handler only.
  - Add a clear path matching toolbar behavior:
    - Prefer adding a rail prop like `onClearStyleCustomAccent` and wiring it to `ProposalColorPickerPopover.onClear`.
    - Pass `onClear` only when `isSeventhCustomToneSelected` is true; do not show the clear action for the muted unselected starter swatch or for fixed-hex swatches stored as `palette: "custom"`.
    - The page handler should clear `proposalCustomAccentHex`, clear custom palette state, and fall back to the current base style/palette without mutating content.
  - Keep initial unselected visual muted/dimmed; once `stylePreset.palette === "custom"` and a valid `accentHex` exists, show the selected color normally.

### Phase 2 — Match toolbar color-wheel sizing
- Update `my-app/src/styles/product-proposal.css`:
  - Make `.dasti-proposal-skeleton-rail__style-swatch-wheel` fill the swatch: `width: 100%; height: 100%;`.
  - Remove the current fixed `17px` sizing.
  - If an inset is desired, apply it as padding/inset on `.dasti-proposal-skeleton-rail__style-swatch--icon`, not by shrinking the SVG.
  - Keep muted default via filter/opacity only while the custom swatch is not selected.
  - Ensure selected custom state uses the actual `--proposal-accent-swatch` fill and does not show the wheel overlay.
  - Remove the obsolete `.dasti-proposal-skeleton-rail__style-swatch--custom input` CSS after the native input is removed.

### Phase 3 — Make style-only edits persist deterministically
- Update `my-app/src/pages/ProposalForge.tsx` style handling around one shared commit helper rather than scattered state writes.
- Add a helper conceptually like `commitProposalLocalStyle(nextStyle, helpers)` that:
  - Resolves/sanitizes `nextStyle` once.
  - Computes `nextTemplateId = getProposalTwinTemplateId(resolvedStyle)`.
  - Sets `proposalStyleLinkMode` to `"proposal_local"`.
  - Sets `proposalStylePreset`, `proposalWorkspaceStyle`, `proposalTemplateId`, `hasUserEditedStyle`, and `proposalStyleChoice` coherently.
  - Updates helper fields explicitly from arguments: `{ templateBundleId, paletteOverride, customAccentHex }`.
  - Updates a synchronous ref such as `latestProposalStyleCommitRef` containing `{ proposalId, revision, templateId, verbatiStyle, styleLinkMode, styleChoice, templateBundleId }` so an immediate Save to Library can use the just-selected style before React's next render. The ref must be scoped to the current compose draft/server id to prevent a style commit from leaking after reset, saved-view navigation, or a new generation.
- Handler rules:
  - Style preset buttons (`Style 1`–`Style 3`) should set `templateBundleId` to the chosen numbered style, clear palette/custom helpers unless the chosen bundle itself is custom, and close any open custom color popover.
  - Font pair changes should preserve the current effective palette/accent, close any open custom color popover, but should not allow a stale bundle definition to overwrite the chosen typography. Either clear `templateBundleId` for font overrides or keep it only as a base-style label while ensuring the sync effect never reapplies the bundle over `hasUserEditedStyle`.
  - Accent swatches must distinguish the two existing storage shapes:
    - Palette-id swatches such as `sauge`/`ocre` should persist as `verbatiStyle.palette = "sauge" | "ocre"` with no `accentHex`.
    - Fixed hex swatches such as Terre/Ink/Cobalt/Plum should persist as `verbatiStyle.palette = "custom"` plus the fixed `accentHex`, not as fake palette ids. They should not set the seventh-tone `customAccentHex` helper unless that helper is intentionally redefined to mean any hex override.
    - The seventh custom tone should also persist as `palette: "custom"` plus the user-picked `accentHex`, but its UI/helper state is distinct from the fixed hex swatches.
  - Fixed palette/hex accent changes should preserve current typography/base style, close any open custom color popover, and persist the chosen color in the authoritative `verbatiStyle`. If helper fields are kept, they must match the resolved style; otherwise omit them instead of writing stale/null helper values.
  - Seventh-custom accent changes should preserve current typography/base style, set `palette: "custom"`, preserve `customAccentHex` as the user-custom helper, and persist the custom hex in authoritative `verbatiStyle.accentHex`.
  - Clear custom accent should clear only the seventh-tone custom selection, close the picker, and resolve back to the current base/fixed palette without touching proposal content.
- Snapshot/save rules:
  - `proposalRenderMetadata` and `proposalPersistenceMetadata` should continue to serialize the authoritative current style.
  - `buildComposeSaveSnapshot()` or `flushScheduledProposalSave()` must merge in `latestProposalStyleCommitRef` when it is newer than the rendered metadata, so immediate Save to Library after a rail click cannot save the previous style.
  - The output-draft/local-storage write path should use the same authoritative style snapshot or the same merged metadata helper, so reload-before-autosave does not revert to the previous style.
  - The autosave token must include the authoritative `verbatiStyle`, `templateId`, and `styleLinkMode`; a style-only change should change the token even when title/content is unchanged.
  - After a successful save, clear or mark the latest-style ref as persisted only when the saved token includes that style commit.
  - Clear/reset the latest-style ref on workspace reset, new generation start, saved-view open, loaded draft switch, successful Save to Library cleanup, and attached-CV style inheritance reset. Do not carry it across proposal ids or route modes.
  - When loading an existing draft proposal, derive helper fields from that draft's own metadata/authoritative `verbatiStyle` instead of reusing current `proposalPaletteOverride`, `proposalCustomAccentHex`, or `proposalTemplateBundleId` state. In particular, infer fixed-hex vs seventh-custom selection from `verbatiStyle.palette`/`accentHex`, and infer the numbered bundle with `findProposalTemplateBundleIdByStylePreset()` only when it truly matches.

### Phase 4 — Preserve job context and route saved documents into Proposal Forge
- Treat saved/draft proposal job context as part of the same persistence contract as style. Save and reopen must preserve:
  - source job description (`metadata.sourceJobDescription`),
  - source URL (`metadata.sourceUrl`),
  - source platform/domain (`metadata.platform`),
  - canonical job id (`metadata.jobId`) when present,
  - a usable job title. Add/normalize explicit metadata typing for `jobId` and for `sourceJobTitle` if canonical job lookup cannot always provide the title. Use the saved proposal title only when it is actually the job title; otherwise derive a display title from canonical job id or explicit source metadata rather than inventing one from the proposal subject.
- When `buildComposeSaveSnapshot()` merges the latest style commit, it must preserve the current source/job metadata from `proposalPersistenceMetadata`; do not replace metadata with a style-only partial that drops source fields.
- On Save to Library, do not clear the only copy of job context before the saved row has become the reopen source of truth. Clearing local compose/output drafts is fine only after the saved metadata has been confirmed to include source context.
- When loading a draft proposal into compose mode, build `outputSourceComposeDraft` / rail job context from the draft row metadata instead of writing `sourceComposeDraft: null`. The current plan already calls out helper-field leakage; extend the same rule to source/job fields.
- When opening a saved proposal from Proposal Library, the Proposal Forge rail/brief should derive job context from the selected saved row metadata/canonical job record, not from stale or cleared local compose draft storage.
- Route policy:
  - The implementation should not send a successful Save to Library into the old `ProposalsList` detail shell if that page is dismissed.
  - Prefer opening the saved row in the Proposal Forge workbench with the saved proposal id selected/hydrated. If the existing `/proposal?view=saved&id=...` URL must remain for compatibility, make it a compatibility route that renders/hydrates the Forge workbench or redirects to the new Forge document route; do not make it the target UX after save.
  - Sidebar, Documents, Jobs, and Proposal Library links should follow the same route contract so saved/draft proposals do not split across two document experiences.

### Phase 5 — Saved-view/workbench rehydration guardrails
- Keep saved document correctness based on `openedSavedProposal.metadata.verbatiStyle` and `openedSavedProposal.metadata.templateId` through `resolveProposalRenderState()`.
- Do not let stale `savedProposalStylePreset` / `savedProposalTemplateId` state from a previously opened saved proposal override the newly selected `openedSavedProposal.metadata`. Either derive the effective saved render state directly from `openedSavedProposal` in a memo, reset saved style state synchronously when `selectedProposalId` changes, or key the saved-style state by proposal id and ignore it when the id does not match.
- Explicitly define the pre-generation boundary: if there is no proposal content and no server proposal id, style choices can update preview/default generation state, but they cannot be autosaved to a proposal row. If product wants pre-generation style choices to survive reload, add a compose-draft style persistence path separately; do not fake proposal-row persistence without content.
- Do not require `paletteOverride`, `customAccentHex`, or `templateBundleId` for saved-view render correctness. Those can help rebuild controls, but the saved document must render correctly from `verbatiStyle` alone.
- Add trace/test assertions that saved view uses the saved row metadata and is not falling back to:
  - the default style,
  - attached CV style when `styleLinkMode === "proposal_local"`,
  - local/session output draft from a different proposal.

### Phase 6 — Add regression coverage for the actual rail path
- Update/add tests:
  - `my-app/src/components/proposal/__tests__/ProposalRail.style.test.tsx`
    - Assert the custom swatch is a button and that no `input[type="color"]` is rendered.
    - Click the custom swatch and assert the `Custom accent color` popover appears.
    - In JSDOM, prefer keyboard interaction on the popover sliders or a focused mock of `ProposalColorPickerPopover`; pointer math depends on layout rectangles that are usually zero in JSDOM. Do not rely on native input change events.
    - Add a case where a fixed-hex swatch is active and the seventh custom swatch is opened; assert it uses the muted starter behavior and does not show the clear action.
    - Add a case that opens the custom picker, then switches tabs or selects another accent/style, and asserts the popover is closed/not surprise-reopened.
    - For wheel sizing, prefer a CSS assertion or browser/computed-style check; class presence alone is not enough to prove the icon fills the circle.
  - `my-app/src/pages/__tests__/ProposalForge.autosave.test.tsx`
    - Remove/update the stale `EmbeddedStyleInspector` mock for this behavior.
    - Exercise the real `ProposalRail` where practical. If the full DOM is too heavy, mock `ProposalRail` with explicit buttons that call `onSelectStyleBundle`, `onSelectStyleTypography`, `onSelectStylePalette`, and `onSelectStyleCustomAccent` so the page handlers/save path are tested directly.
    - Change font pair, palette-id swatch, fixed-hex swatch, and seventh-custom accent as style-only edits, wait for autosave, and assert `mockUpdateProposal` receives metadata with updated `verbatiStyle`, `templateId`, and `styleLinkMode: "proposal_local"` while content/title are unchanged.
    - Include a fixed-hex swatch case proving the page handler does not mark it as the seventh custom helper/source.
  - `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
    - Generate/load a proposal, change rail style only, immediately click Save to Library, and assert the saved row metadata contains the changed style without content edits.
    - Include the immediate-click case specifically to catch React state race regressions.
    - Include both update-existing-id and create-new-saved-row cases, because `flushScheduledProposalSave()` can route to `updateProposal` or `createProposal` depending on `generatedProposalIdRef.current`.
    - Assert saved metadata still includes job context (`sourceJobDescription`, `sourceUrl`, `platform`, `jobId` where present, and the agreed job-title source) after style-only saves and after Save to Library cleanup clears local drafts.
    - Assert the post-save navigation follows the new Proposal Forge document route/workbench contract, not the dismissed old saved display shell.
  - `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
    - Open a saved proposal whose metadata has a distinctive local style/custom accent.
    - Expose `stylePreset`/`templateId` from the mocked display/stage if needed, then assert saved view uses that saved metadata.
    - Add a second saved proposal with a different style to prove reopening/switching does not leak styles across proposals.
    - Specifically cover fast switching between saved proposal ids so stale `savedProposalStylePreset` state cannot render the previous proposal's style.
    - Add a saved proposal with source job metadata and no local compose draft; assert the Proposal Forge rail/brief still shows the attached job context after library reopen.
  - Route/link tests (`my-app/src/components/__tests__/Sidebar.proposal-navigation.test.tsx`, `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`, or the route test closest to the final contract):
    - Sidebar saved proposal links, Documents proposal links, Jobs linked-proposal links, and Save to Library navigation should all open the same Proposal Forge document experience.
    - If `/proposal?view=saved&id=...` remains as a legacy-compatible URL, assert it redirects or hydrates into the new Forge experience rather than rendering the old `ProposalsList` detail UI as the final destination.

### Phase 7 — Verification
Run narrow checks:
- `cd my-app && rtk npx tsc --noEmit`
- `cd my-app && rtk npx vitest run src/components/proposal/__tests__/ProposalRail.style.test.tsx`
- `cd my-app && rtk npx vitest run src/pages/__tests__/ProposalForge.autosave.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx src/pages/__tests__/ProposalForge.saved-view.test.tsx`

Because this is browser-facing UI, also run a rendered browser check when available proving:
- custom wheel fills the swatch circle by computed size, not just by class name,
- popover is the app `Custom accent color` picker,
- style-only change saves without content/title changes,
- immediate Save to Library after style change saves the new style,
- reopening from Proposal Library keeps the selected style,
- reopening from Proposal Library keeps the attached job context,
- Save to Library and library/sidebar/document links land in the intended Proposal Forge workbench experience, not the dismissed old saved display shell.
