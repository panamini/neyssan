# Plan — Document Style Hierarchy Alignment

## Scope and non-goals

This is a future implementation architecture/spec for aligning the **style hierarchy** across Settings, CV Forge, and Proposal Forge. This review pass edits the plan only; implementation is intentionally deferred.

Non-goals for this plan:

- Do not implement code in this review pass.
- Do not redesign Proposal Forge layout choices now.
- Do not treat CV templates as style names.
- Do not collapse Proposal Forge and CV Forge into one component before their contracts are clear.
- Do not revive legacy Robial/Grid style identity as a runtime source.

Important product direction:

- **Style 1 / Style 2 / Style 3 are style bundles**, not document templates.
- **CV Template is separate**: `Workshop` and `Workshop 2-col` are template/layout choices.
- **Proposal has one layout for now**. Proposal can later visually match CV styles, but it must not inherit CV two-column structure.
- A user can choose a default style in Settings, apply a style to a CV/proposal, then override that document locally. The UI should show a custom state for that document.

## Implementation status checkpoint

This checkpoint reflects the current code progress against the original phased plan. It is not a request to broaden scope; remaining work should continue in small, reversible slices.

### Completed or largely covered

- **Phase 0 product/data decisions:** locked for this pass as separate CV/proposal active slots, `verbatiStyleSlotId` as shared document identity, `templateBundleId` as proposal compatibility alias, CV ignoring proposal signature/voice, and reset targeting current Settings slot only for settings-sourced documents.
- **Phase 1/3 data-contract compatibility:** shared slot helpers exist; CV metadata, proposal metadata, Convex public projections, profile/public metadata, and local proposal drafts now accept/preserve slot identity, base snapshots, and `documentStyleVersion`.
- **Phase 4 CV style/template separation hardening:** CV style selection persists slot metadata, selected style inference ignores `resumeTemplateId`, custom-state comparison ignores template changes, and CV reset preserves the current template.
- **Phase 6 proposal compatibility:** proposal style bundle metadata derives from the slot mapping, draft/saved restore can recover from slot-only metadata, and inactive `ProposalForgeNext` has compatibility hardening without making it an active route.
- **Phase 8 CV custom/reset semantics:** CV rail shows `Style N · Custom`, reset writes the chosen base snapshot, and tests cover custom labels, reset contracts, and template-only changes not marking style custom.
- **Phase 10 partial export/render compatibility:** shared proposal render-state recovery now prefers persisted proposal style/base/slot metadata before falling back to active CV/default style; Proposal Forge export covers slot-only draft recovery; CV style reads now recover from base-snapshot or factory slot metadata when `verbatiStyle` is absent; document export model tests are green.

### Verified so far

- `cd my-app && rtk npx vitest run src/pages/__tests__/CvForge.workspace-mode.test.tsx` — 72 tests passed in the latest full run noted during implementation.
- Targeted proposal/Convex compatibility suites passed in prior implementation slices.
- `cd my-app && rtk npx vitest run src/features/verbati/__tests__/style.test.ts src/pages/__tests__/CvForge.export-status.test.tsx` — 19 tests passed in the latest CV read/export slice.
- `cd my-app && rtk npx vitest run src/pages/__tests__/CvForge.workspace-mode.test.tsx src/pages/__tests__/CvForge.export-status.test.tsx src/features/verbati/__tests__/style.test.ts src/lib/__tests__/proposal-render-state.test.ts src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.export.behavior.test.tsx` — 111 tests passed in the latest broader compatibility slice.
- `cd my-app && rtk npx vitest run src/lib/__tests__/document-export-models.test.ts src/lib/__tests__/exportDocumentFile.test.ts src/pages/__tests__/ProposalPrintPage.test.tsx src/pages/__tests__/ResumePrintPage.test.tsx` — 27 tests passed after aligning Proposal print snapshot expectation to the one-layout workshop contract.
- `cd my-app && rtk npx vitest run src/lib/__tests__/document-export-models.test.ts src/lib/__tests__/exportDocumentFile.test.ts src/pages/__tests__/ResumePrintPage.test.tsx` — 26 tests passed after making styled resume print source recover from slot/base CV metadata when no explicit live style is passed.
- `cd my-app && rtk npx vitest run src/pages/__tests__/CvForge.workspace-mode.test.tsx src/pages/__tests__/CvForge.export-status.test.tsx src/features/verbati/__tests__/style.test.ts src/lib/__tests__/document-export-models.test.ts src/lib/__tests__/exportDocumentFile.test.ts src/pages/__tests__/ResumePrintPage.test.tsx src/pages/__tests__/ProposalPrintPage.test.tsx src/lib/__tests__/proposal-render-state.test.ts src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.export.behavior.test.tsx` — 139 tests passed in the latest render/export compatibility suite.
- `cd my-app && rtk npx vitest run convex/__tests__/proposalPublicStyleCompatibility.test.ts convex/__tests__/proposalsPublic.test.ts convex/lib/__tests__/userProfileMetadata.test.ts convex/lib/__tests__/userProfileMetadataSchemaAlignment.test.ts src/adapters/__tests__/StorageAdapter.test.ts src/lib/__tests__/document-style-slots.test.ts src/lib/__tests__/proposal-output-draft.test.ts src/components/__tests__/ProposalsList.saved-view-typography.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx` — 49 tests passed across Convex/public projection, storage/draft serialization, saved preview, and save-to-library metadata compatibility.
- `cd my-app && rtk npx vitest run src/lib/__tests__/export-renderers.test.ts` — 16 tests passed for styled export renderer parity.
- `cd my-app && rtk npx vitest run --exclude pdf-ingest/* --reporter=dot` — attempted as a final broad sweep; it did not complete due existing broad-suite harness/environment failures and then Node heap exhaustion. Notable failures/errors were mostly outside the style-slot tranche: missing Convex deployment, JSDOM `HTMLCanvasElement.getContext` gaps, `convex.query is not a function` in legacy section-editor tests, then OOM. One stale Proposal Forge test mock exposed by this sweep was repaired below.
- `cd my-app && rtk npx vitest run src/pages/__tests__/ProposalForge.settings-style-roundtrip.test.tsx` — 1 test passed after adding the missing `getLocalPersonalizationSourceByCvId` mock export.
- `cd my-app && rtk npx vitest run src/pages/__tests__/ProposalForge.settings-style-roundtrip.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.export.behavior.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx` — 15 Proposal Forge compatibility tests passed after the stale mock repair.
- `cd my-app && rtk npx vitest run src/lib/__tests__/document-export-models.test.ts src/pages/__tests__/CvForge.export-status.test.tsx src/features/verbati/__tests__/style.test.ts src/pages/__tests__/CvForge.workspace-mode.test.tsx` — 101 tests passed after making CV slot layout/template part of CV Style N application and custom-state comparison.
- `cd my-app && rtk npx tsc --noEmit --pretty false` — currently green.
- `cd my-app && rtk git diff --check` — currently green.

### Remaining implementation slices before calling the plan complete

- Active render/export/print paths were re-scouted and hardened at the known fallback points: CV style reads, CV styled print/export source construction, proposal render-state recovery, saved proposal preview, active Proposal Forge draft reopen, active Proposal Forge export, local output drafts, public projections, and Convex proposal/public metadata projection.
- Proposal Forge now has a narrow export regression test for slot-only draft metadata through the active `Share proposal` → `Export PDF` path, asserting recovered style/template payload.
- CV print/export path verification now includes styled print-source recovery from CV slot-only metadata plus existing `ResumePrintPage`, `exportDocumentFile`, and export-renderer parity coverage.
- Follow-up correction from product review: CV layout/template is now treated as part of the CV side of a shared Style N slot. Applying a CV style slot uses the slot/default Settings CV template, while proposal rendering still maps the same slot identity to proposal-safe layout/template metadata.
- Settings UI changes remain intentionally deferred; this tranche established the compatibility/read-write layer without changing Settings UI behavior.
- Proposal custom/reset parity remains intentionally deferred; CV custom/reset semantics are covered and proposal metadata/export compatibility is green in targeted suites.

## Fresh-eyes code audit summary

### Active files inspected

- `my-app/src/pages/SettingsPage.tsx`
- `my-app/convex/proposalSettings.ts`
- `my-app/src/lib/proposal-template-bundles.ts`
- `my-app/src/components/proposal/ProposalRail.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/pages/ProposalForgeNext.tsx` *(obsolete/dead unless reactivated: `/proposal-next` redirects to `/proposal`, so implementation must not target this file without a new current call site)*
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/components/cv/CvRail.tsx`
- `my-app/src/features/verbati/style.ts`
- `my-app/src/lib/proposal-style-display.ts`
- `my-app/src/lib/layout/documentAppearance.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/document-export-models.ts`
- `my-app/src/pages/ProposalPrintPage.tsx`
- `my-app/convex/lib/userProfileMetadata.ts`
- `my-app/convex/profilesPublic.ts`
- Wiki references:
  - `wiki/tech/proposal-style-layer.md`
  - `wiki/design/document-token-contract.md`

### Confirmed current architecture

Current style concepts are split across several layers:

1. `SettingsPage.tsx` owns three saved preset slots, persisted via `proposalSettings.getPresets/savePreset`.
2. `proposal-template-bundles.ts` owns ProposalRail’s three visible proposal style options, plus two extra internal/legacy bundle ids.
3. `ProposalRail.tsx` already exposes Style 1/2/3 and custom state for proposal bundles.
4. `CvRail.tsx` now exposes Style 1/2/3 plus separate Template buttons.
5. `CvForge.tsx` reads `proposalSettings.getPresets` and applies slots to the current CV while preserving the current `resumeTemplateId` in practice.
6. `VerbatiStylePreset` currently still carries `resumeTemplateId`, so template and visual style are not cleanly separated in persistence yet.
7. CV style slot selection currently uses `stylesEqual(...)`, which compares `resumeTemplateId`; this means a template change can break style-slot/custom-state detection unless a style-only comparator is introduced.
8. Settings preset persistence is still proposal-shaped in Convex (`proposalPreset1/2/3`, `proposalActivePresetSlot`, `proposalVerbatiStyle`, `proposalStyleChoice`) even though CV Forge now consumes it as document style data.

### Confirmed mismatch with desired hierarchy

The desired hierarchy is not yet expressed as one shared contract:

```text
factory defaults
-> user Settings style slots
-> document selected style slot
-> document-local custom overrides
-> render/export snapshot
```

Current code has pieces of this, but there is no single shared resolver or persisted selected slot identity for CV documents.

## Target mental model

### 1. Factory style defaults

Factory defaults are immutable product defaults for Style 1/2/3.

They should be defined once, in a neutral shared module, not duplicated between Settings, Proposal, CV, or `DEFAULT_VERBATI_STYLE` fallback expectations.

Provisional example defaults from product direction:

| Style | CV template default for new docs only | Typography | Palette | Signature |
| --- | --- | --- | --- | --- |
| Style 1 | Workshop one-col | Geist / Baskerville | Ink | Auto |
| Style 2 | Workshop 2-col | Thestral Neue / BioRhyme Light (`civic-correspondence`) | Cobalt | Auto |
| Style 3 | Workshop one-col or product-decided fallback | Special Elite / Courier Prime | Sage | Auto |

These exact font ids must be verified against `fontCatalog.ts` before implementation. Current active evidence: `civic-correspondence` maps to Thestral Neue over BioRhyme Light. If a desired font pair does not exist, the plan must either add it deliberately or map it to an existing supported `VerbatiFontPairId`.

Factory template defaults are only for **new document defaults**. Applying Style 2 to an existing CV must not silently switch that CV from one-column to two-column.

### 2. Settings style slots

Settings Style 1/2/3 are the user-editable defaults derived from factory defaults.

Each Settings slot should contain:

- style slot id: `1 | 2 | 3`
- display name / user-facing label
- typography/font pair
- palette or custom accent
- proposal voice/tone default, if product keeps it in the slot
- signature settings for proposal rendering
- `defaultCvTemplateId` for new CV creation only
- optional proposal-compatible visual mapping for proposals

Do not name the new CV default-template field in a way that implies applying the style slot to an existing CV changes layout. Use a name like `defaultCvTemplateId`, not `resumeTemplateId` inside style identity.

Settings slots should not be described as cover-letter-only if CV Forge also consumes them.

### 3. Document style selection

Each CV/proposal should know which base style slot was selected.

Target persisted document metadata concept for both CV and proposal documents:

```ts
metadata: {
  verbatiStyle: DocumentAppearanceSnapshot; // resolved render/export snapshot
  verbatiStyleSlotId?: 1 | 2 | 3;
  verbatiStyleSlotSource?: "factory" | "settings";
  verbatiStyleSlotNameSnapshot?: string;
  verbatiStyleBaseSnapshot?: DocumentAppearanceSnapshot;
  documentStyleVersion?: 1;
}
```

`VerbatiStylePreset` is the current transition/render shape, not the clean long-term authoring schema. The plan should introduce clearer conceptual shapes:

- `DocumentStyleSlotDefinition`: factory/Settings editable slot defaults.
- `DocumentAppearanceSnapshot`: resolved render/export appearance.
- `DocumentTemplateSelection`: structural document layout/template identity, especially CV `resumeTemplateId`.
- `ProposalToneDefaults`: proposal-only tone/signature defaults.

`DocumentAppearanceSnapshot` must be explicitly narrow:

```ts
type DocumentAppearanceSnapshot = {
  familyId?: StyleFamilyId; // optional in proposal metadata until validators support it
  layout: VerbatiLayoutPreset;
  typography: VerbatiFontPairId;
  palette: VerbatiPalettePreset;
  accentHex?: string;
};
```

It must not include CV template identity, proposal `templateBundleId`, Settings slot edit metadata, UI labels, local draft helper fields, or creation defaults like `defaultCvTemplateId`. Signature/voice fields are proposal-only slot/default data unless a separate product decision adds them to proposal appearance snapshots.

`verbatiStyleBaseSnapshot` is required for stable non-MVP custom-state semantics: compare the current rendered snapshot to the base snapshot captured when the user selected the style. Without it, changing Settings Style 2 later could make old documents unexpectedly appear custom or non-custom.

Metadata field types:

```ts
type DocumentStyleSlotId = 1 | 2 | 3;
type DocumentStyleSlotSource = "factory" | "settings";
type DocumentStyleVersion = 1;
```

A runtime-only `legacy-inferred` source may be used in UI/debug traces for exact legacy matches, but it must not be persisted. Persist only `"factory"` or `"settings"` after explicit user save/style selection.

Proposal compatibility during transition:

```ts
metadata: {
  templateBundleId?: ProposalTemplateBundleId; // compatibility alias, not future style identity
  styleChoice?: ProposalStyleChoice; // legacy proposal tone/style-choice field, not Style 1/2/3 identity
}
```

Do not reuse `styleChoice` for Style 1/2/3 identity. In active code it means `"auto" | "formal" | "warm" | "technical" | "balanced"`, not a document style slot.

`verbatiStyle` remains the render/export authority because it is a complete resolved snapshot. The selected slot id is UI/base-style identity, not a replacement for the snapshot. If both `verbatiStyleSlotId` and legacy `templateBundleId` exist on a proposal and disagree, prefer `verbatiStyleSlotId` for UI identity; preserve `templateBundleId` only as a compatibility alias until the next explicit style save can normalize it.

Render/export source of truth:

1. `document metadata.verbatiStyle`
2. local draft `verbatiStyle`
3. selected Settings slot resolved snapshot
4. factory slot

Settings slot changes never affect existing documents unless the user explicitly chooses Reset or re-applies the style.

### 4. Document-local custom overrides

If a user selects Style 2 and then changes font/color/signature/template locally:

- keep Style 2 selected as the base;
- show `Style 2 · Custom`;
- render/export from the current resolved `verbatiStyle` snapshot;
- compare custom state against `verbatiStyleBaseSnapshot`, not against whichever Settings slot value happens to exist today;
- keep `verbatiStyleSlotSource` as historical/base identity metadata, not as a live link that can silently mutate the document when Settings changes;
- allow Reset to restore the selected base slot defaults using explicit reset semantics below.

If Settings Style 2 changes after a document selected Style 2:

- existing document rendering remains unchanged;
- existing document metadata remains unchanged;
- `Style 2 · Custom` is computed against the captured `verbatiStyleBaseSnapshot` for stable labels;
- Reset can intentionally pull current Settings Style 2 only after explicit user action, if Phase 0 chooses that reset target.

Reset write contract:

- If Reset uses current Settings slot values, write both `metadata.verbatiStyle` and `metadata.verbatiStyleBaseSnapshot` to the resolved current Settings slot snapshot, refresh `verbatiStyleSlotNameSnapshot`, keep `verbatiStyleSlotSource: "settings"`, and keep/update `documentStyleVersion` according to the migration contract.
- If Reset uses factory fallback values, write both current and base snapshots to the resolved factory slot snapshot, refresh the name snapshot, and use `verbatiStyleSlotSource: "factory"`.
- After Reset, the document must not remain marked `Style N · Custom` unless the user immediately changes a compared appearance field again.

For CVs, template customization is separate:

- changing `Workshop` / `Workshop 2-col` should not clear the selected style slot;
- changing Style 1/2/3 should not change the selected CV template for an existing CV;
- template differences alone should not show `Style N · Custom`.

For proposals:

- Proposal layout remains one-layout for now;
- Style 1/2/3 only change proposal-compatible visual style;
- proposal custom state should preserve the selected base style id and show `Style N · Custom`.

## Corrected architecture plan

### Phase 0 — Resolve prerequisite product/data decisions

Before writing code, decide and record:

1. Exact factory defaults for Style 1/2/3, including valid `VerbatiFontPairId` values from `fontCatalog.ts`.
2. Blocking active-default model decision. Choose exactly one before implementation:
   - Option A: one shared `activeDocumentStyleSlotId` for new CVs and proposals.
   - Option B: separate `activeCvStyleSlotId` and `activeProposalStyleSlotId`.
   All schemas, Settings UI, creation paths, and tests must use only the chosen model.
3. Whether Reset uses the **current Settings slot values** or the **factory default** for the selected slot. Recommended: reset to current Settings slot when `verbatiStyleSlotSource === "settings"`, and factory slot when source is `"factory"` or the Settings slot no longer exists.
4. Whether proposal documents persist `verbatiStyleSlotId` as the new shared identity while keeping `templateBundleId` as a compatibility alias. Recommended: yes.
5. Whether CV ignores proposal-only signature/voice fields entirely or stores them inertly. Recommended: CV style application ignores them; proposal consumes them.
6. Exact proposal `verbatiStyle` persisted shape: keep the current proposal-document snapshot as `{ layout, typography, palette, accentHex }`, or update all proposal validators/projections to include `familyId`. Do not imply full `VerbatiStylePreset` persistence unless Convex validators support it.
7. Font/export availability: every factory font pair must exist in `fontCatalog.ts`, preview/print/PDF paths must resolve it, and DOCX fallback must be deterministic.
8. Active default migration: decide whether `proposalActivePresetSlot` becomes one shared `activeDocumentStyleSlotId`, or splits into `activeCvStyleSlotId` and `activeProposalStyleSlotId`.

### Phase 1 — Lock persisted data contracts before frontend adapters

Lock the durable data contract before building frontend adapters. This phase owns metadata field names, schema versions, sanitizer behavior, and read/write compatibility for Settings, CVs, proposals, public projections, and local drafts.

Do not build UI helpers against fields that backend/public/local-draft storage cannot persist yet.
Do not implement Settings UI changes before schema/read-path compatibility for CV, Proposal, local drafts, and public projections exists. Otherwise the UI can display selected slots that disappear after refresh/save.

After the data contract is accepted, use this proposed module split, subject to active code path inspection, rather than one overgrown helper:

- `my-app/src/lib/document-style-slots.ts` — slot ids, factory defaults, slot types.
- `my-app/src/lib/document-style-slot-resolver.ts` — normalization from Settings/factory data to resolved slots.
- `my-app/src/lib/cv-style-slot-adapter.ts` — CV-specific apply/compare/reset helpers.
- `my-app/src/lib/proposal-style-slot-adapter.ts` — Proposal-specific apply/compare/compat mapping helpers.

Before creating new modules, inspect existing `documentAppearance.ts`, `proposal-template-bundles.ts`, `features/verbati/style.ts`, and `styleState.ts` for reusable normalization/export helpers. Avoid creating a parallel style system if an existing active helper can be safely generalized.

The contract should own:

- `DOCUMENT_STYLE_SLOT_IDS = [1, 2, 3]`
- factory defaults for Style 1/2/3
- type for a resolved style slot
- normalization from saved Settings preset to resolved slot
- deterministic compatibility mapping between slot ids and current Proposal bundle ids:
  - Style 1 → `swiss_serif`
  - Style 2 → `magazine_editorial`
  - Style 3 → `grid_mono`
- helper to apply a slot to a CV without changing current `resumeTemplateId`
- helper to apply a slot to Proposal without introducing a two-column proposal layout
- style-only comparators for custom state
- base snapshot capture and reset-target resolution
- schema/version helpers for `documentStyleVersion`

Critical design rules:

- This contract may return `defaultCvTemplateId` for **new CV creation**, but the `applyStyleSlotToExistingCv(...)` helper must preserve the current CV template.
- Do not use existing `stylesEqual(...)` for CV style-slot selection/custom state unless it gains an explicit option to ignore template. Active `stylesEqual(...)` currently compares `resumeTemplateId`.
- Proposal `styleChoice` remains a legacy/proposal-tone compatibility field and must not become Style 1/2/3 identity.
- Proposal Style 1/2/3 must not change page geometry, two-column structure, pagination model, or print payload structure. Any `layout` value in proposal style snapshots is appearance/compatibility only unless a future Proposal layout project explicitly changes this.

### Phase 2 — Normalize Settings schema/API as first-class document style slots

Update Settings plan/implementation later so Settings slots are product-wide document styles, not proposal-only presets.

This requires Convex/backend work, not only frontend Settings changes:

- add/normalize target Settings fields in `my-app/convex/proposalSettings.ts` and user profile storage;
- keep existing `proposalPreset1/2/3` readable during migration;
- decide whether to rename to document-style fields now or add compatibility aliases first;
- expose a read API that returns resolved document style slots with factory fallback;
- expose a write API that validates slot id, palette/custom accent, default CV template, signature, and proposal voice fields.

Proposal document metadata also needs explicit Convex/API support before any writer can persist the new slot identity:

- `my-app/convex/schema.ts`
- `my-app/convex/proposals.ts`
- `my-app/convex/proposalsPublic.ts`
- `my-app/convex/createProposalPublic.ts`
- `my-app/convex/updateProposalPublic.ts`

These validators/write/read paths currently accept or return `verbatiStyle`, `styleChoice`, and `templateBundleId`, but not `verbatiStyleSlotId`, `verbatiStyleSlotSource`, `verbatiStyleSlotNameSnapshot`, `verbatiStyleBaseSnapshot`, or `documentStyleVersion`. Add those fields to the proposal metadata validators, sanitizers, and public query projection before wiring Proposal Forge UI writes.

CV document metadata needs the equivalent write/read support:

- `my-app/src/types/cvDocument.ts` / `CvMetadata` typing remains passthrough, but should document the new fields.
- `my-app/src/schemas/cvDocument.schema.ts` should validate/pass through the new style slot fields deliberately.
- `my-app/src/contexts/CvLibraryContext.tsx` `saveCurrentCvStyleOnly(...)` currently writes only `metadata.verbatiStyle`; it must accept and persist the selected slot identity fields too.
- `my-app/src/adapters/StorageAdapter.ts` `saveMetadataPatch(...)` currently accepts only `Pick<CvDocument["metadata"], "verbatiStyle">`; it must preserve/sanitize the new fields and send them in metadata-only patches.
- `my-app/src/adapters/profile-mapper.ts` must round-trip the new metadata fields when restoring CVs from persisted profiles.
- Convex profile metadata paths must also accept/canonicalize/project these fields: `my-app/convex/lib/userProfileMetadata.ts`, `my-app/convex/profilesPublic.ts`, and the user profile/cvDocument validators in `my-app/convex/schema.ts`.

Local Proposal draft storage needs compatibility before Proposal Forge writes slot ids:

- `my-app/src/lib/proposal-output-draft.ts` currently persists `proposalVerbatiStyle`, `templateBundleId`, palette/font/layout overrides, and related helpers.
- Add `verbatiStyleSlotId`, `verbatiStyleSlotSource`, `verbatiStyleSlotNameSnapshot`, `verbatiStyleBaseSnapshot`, and `documentStyleVersion` to draft read/write types.
- Old local drafts with only `templateBundleId` should restore the compatibility base non-destructively.
- Refreshing Proposal Forge before Convex save completes must not lose selected base style/custom-state identity.

Settings must support:

- Style 1/2/3 display names;
- font pair selection;
- palette/custom accent selection;
- signature selection;
- `defaultCvTemplateId` choice for new CVs only;
- active default slot selection, using only the active-default model chosen in Phase 0.

`defaultCvTemplateId` belongs to document creation defaults only. It is not part of `DocumentAppearanceSnapshot`, is not compared for custom state, and is not applied by visual-style reset.

Settings defaults should hydrate from the shared factory defaults, not from independent hardcoded font lists in `SettingsPage.tsx`.

Current mismatch to fix later:

- `SettingsPage.tsx` currently defaults slots to `quiet-editorial`, `geist-baskervville`, `ledger-sans`.
- `proposal-template-bundles.ts` currently defaults visible proposal styles to different values.

Those must be reconciled through the shared contract, along with `DEFAULT_VERBATI_STYLE` in `features/verbati/style.ts` so fallback behavior does not quietly create a fourth default style.

### Phase 3 — Add read-path compatibility and metadata migration before new writers

Before UI starts writing new fields, add schema and read-path compatibility:

- proposal metadata validators/API paths accept and return the new style slot identity fields without dropping them;
- proposal local output drafts accept and return the new style slot identity fields without dropping them;
- CV metadata patch/storage/restore/profile-public paths accept and return the new style slot identity fields without dropping them;
- old CV with only `metadata.verbatiStyle` renders unchanged;
- old CV with `resumeTemplateId` embedded in `verbatiStyle` renders unchanged;
- old proposal with only `templateBundleId` resolves a visible Style 1/2/3 compatibility base when safe;
- old proposal with only `metadata.verbatiStyle` renders unchanged;
- legacy palette ids remain readable.

Persist inferred slot ids lazily only after a user saves/selects a style, not merely by opening an old document. UI may show an inferred base as a non-destructive fallback when the match is exact.

Destructive migration avoidance invariants:

- no eager database migration overwrites existing `metadata.verbatiStyle`;
- opening a document does not mutate style metadata;
- saving Settings does not rewrite all existing CV/proposal documents;
- explicit document save/style selection is the boundary for writing new slot metadata.

### Phase 4 — Separate CV style from CV template in metadata and UI

Current state:

- `VerbatiStylePreset` can carry `resumeTemplateId`.
- `CvRail` has separate Style and Template controls visually.
- `CvForge` currently preserves `resumeTemplateId` when applying style slots by spreading the current `stylePreset`; this is local/fragile and must become an explicit shared helper contract.
- There is no persisted selected style slot id or custom state label.
- Template buttons still write through the style preset rather than a clean separate metadata field.

Target:

- CV visual style selection persists a selected slot id.
- CV template persists separately as selected `resumeTemplateId` or future explicit template metadata field.
- Existing `metadata.verbatiStyle.resumeTemplateId` can remain as compatibility during transition, but the plan should not treat it as the long-term clean ownership model.

Implementation sequence later:

1. Add metadata fields for selected style slot identity.
2. Update CV style persistence so selecting Style 1/2/3 writes:
   - selected slot id;
   - selected slot source/name snapshot;
   - resolved `metadata.verbatiStyle` snapshot;
   - current template unchanged.
3. Update Template buttons so they write only template identity.
4. Add a CV-specific style-only comparator that ignores template and proposal-only fields.
5. Update CV rail labels so selected style can show:
   - `Style 1`
   - `Style 1 · Custom`
6. Add Reset behavior for a custom style slot with the semantics decided in Phase 0.

### Phase 5 — Define new-document, duplicate, and restore semantics

The hierarchy applies before a user opens the style rails. Cover creation and restoration paths explicitly:

- New blank CV: use Settings active CV/document slot if available; otherwise factory default. Apply `defaultCvTemplateId` only at creation time.
- Imported/ingested CV: preserve extracted content; apply Settings active CV/document slot only if product wants imports styled immediately, otherwise factory/neutral default. Never change the template later through style selection.
- Duplicated CV: preserve `verbatiStyle`, `verbatiStyleSlotId/source/nameSnapshot`, `verbatiStyleBaseSnapshot`, custom state, and current CV template from the source document. Do not re-resolve against current Settings.
- New proposal from job/CV context: use explicit user selection if present; otherwise Settings active proposal/document slot; otherwise CV attachment snapshot only if style link mode is `inherit_cv`; otherwise factory default.
- Duplicated/reopened proposal: preserve `verbatiStyle`, slot identity/base snapshot, custom state, content, job context, selected CV attachment, and one-layout renderer metadata. Do not re-resolve against current Settings unless the user explicitly resets.

Resolvers must be deterministic and pure under partial hydration:

- Settings slots loading/unavailable must not erase a document’s persisted `verbatiStyle`.
- Convex mutation failure after local optimistic style change must follow the app’s existing optimistic-save pattern and must not claim durable persistence unless the save succeeds.
- Old localStorage drafts with only `templateBundleId` remain readable.
- Rapid template/style changes must preserve last user intent and avoid template changes caused by style writes.

### Phase 6 — Keep Proposal layout one-layout while preserving base/custom style behavior

Current ProposalRail already has a useful model:

- selected style bundle id is separate from actual `stylePreset`;
- custom state is detected by comparing selected bundle defaults to current style;
- UI can show `Style N · Custom`.

Correct this conceptually:

- Proposal visible Style 1/2/3 should be backed by the same style-slot contract as Settings.
- Proposal selected style identity should persist as `verbatiStyleSlotId` when available.
- `templateBundleId` remains a transition/compatibility alias for existing ProposalRail behavior and older documents.
- Proposal should not expose CV template choices.
- Proposal should resolve all CV two-column/default template concerns into one proposal-compatible layout.
- `templateId` remains structural renderer metadata, not the user-facing style identity.

Current code note:

- `proposal-template-bundles.ts` has five bundle ids, while UI exposes three.
- Plan should classify `swiss_mono` and `magazine_serif` as internal/legacy unless product explicitly wants five public styles.

### Phase 7 — Fix palette/custom semantics before implementation

Named palette swatches are active product tokens:

- `terre`
- `cobalt`
- `ink`
- `sauge`
- `plum`
- `ochre`

Correct persistence rule:

- named swatches persist as `palette: <named id>` with no `accentHex`;
- arbitrary color picker values persist as `palette: "custom"` plus normalized `accentHex`;
- if product keeps any fixed-hex accent choices that are not named palettes, they should be treated as custom accents deliberately and tested separately from named palette buttons.

Do not treat Terre/Cobalt/Ink/Sage/Plum/Ochre as fake fixed hex custom colors. That would contradict `proposal-style-layer.md` and `documentAppearance.ts`.

### Phase 8 — Unify custom-state and reset semantics

For both CV and Proposal:

- selected base style id should remain stable after manual edits;
- custom state should be computed by comparing current document style to selected base slot;
- comparison should use canonicalized values, not raw UI values;
- template differences should not mark a style custom unless product explicitly decides template belongs to style.

Canonical CV comparison fields:

- compare: `familyId/layout`, `typography`, `palette`, normalized `accentHex` when palette is `custom`;
- ignore: `resumeTemplateId`, proposal voice, proposal signature settings, proposal `templateId`, `templateBundleId`, `styleChoice`.

Canonical Proposal comparison fields:

- compare: proposal-compatible `familyId/layout`, `typography`, `palette`, normalized `accentHex` when palette is `custom`, and proposal signature/voice only if product defines those as part of Style 1/2/3;
- ignore: CV `resumeTemplateId`, CV `defaultCvTemplateId`, impossible CV-only fields.

Reset semantics:

- Reset visual style only unless product explicitly adds separate reset controls for template/signature.
- CV Reset must preserve the current CV template.
- Proposal visual Reset must preserve proposal content, job context, selected CV attachment, and one-layout renderer metadata.
- Proposal full style reset, if added later, may include signature/voice but should be a separate explicit action or a separately confirmed product behavior.
- Reset source follows the Phase 0 decision: current Settings slot for settings-sourced documents, factory slot for factory-sourced/fallback documents, while `verbatiStyleBaseSnapshot` preserves stable custom-state comparison regardless of the reset source.

### Phase 9 — Signature and voice ownership

Settings slots include `signatureSettings` today.

Plan requirement:

- Signature is part of the Settings style slot for proposal rendering.
- Proposal can use signature settings directly.
- Proposal voice/tone may remain part of the Settings slot if product wants Style 1/2/3 to include tone defaults. Before implementation, choose one ownership model: creation defaults only, style selection applies them but visual reset excludes them, full proposal-style reset includes them, or omit them from this style-slot pass.
- CV must ignore proposal signature and voice fields for rendering and custom-state comparison unless product later defines CV signature behavior.
- Applying Style 1/2/3 to a CV should not accidentally add proposal-only signature UI to CV output.

This must be explicit because the user’s hierarchy includes “signature auto for all,” but CV and proposal surfaces do not share signature rendering today.

### Phase 10 — Export/print/DOCX and renderer contract

Slot identity is metadata/UI state. Render/export must continue to use resolved snapshots and explicit template ids, not re-resolve appearance from Settings or proposal bundle defaults at export time.

Requirements:

- Preview uses the resolved `verbatiStyle` snapshot plus explicit CV/proposal template identity.
- Print routes receive the same resolved snapshot and must work whether slot identity fields are absent or present.
- PDF export uses the same snapshot as preview/print.
- DOCX export uses the snapshot where supported and otherwise applies an explicit deterministic fallback; CV DOCX remains one-column/linear unless separately changed.
- Runtime-only helper fields are stripped or ignored by export payload validators.
- Proposal export/print never reconstructs layout from CV two-column template or Settings slot defaults.

Add checks around:

- `my-app/src/lib/document-export-models.ts`
- `my-app/src/lib/exportDocumentFile.ts`
- `my-app/src/pages/ProposalPrintPage.tsx`
- CV print/export paths in `CvForge.tsx`, `ResumePrintPage.tsx`, and `exportDocumentFile.ts`
- Proposal render/export paths in `ProposalForge.tsx`

### Phase 11 — Migration and compatibility matrix

Existing saved data may have:

- `metadata.verbatiStyle` only;
- Proposal `templateBundleId` only;
- old palette ids such as `ocre`, `pierre`, `bordeaux`, `encre`;
- CV style with `resumeTemplateId` embedded in `verbatiStyle`.

Migration/compat rules:

- never break rendering from `metadata.verbatiStyle`;
- infer selected slot id only as a UI fallback when exact match is safe;
- persist inferred slot id only after an explicit user save/style selection;
- do not overwrite saved CV templates when adding style slot identity;
- keep legacy palette ids readable but do not expose them as new choices.

Legacy palette handling:

| Legacy id | Rule |
| --- | --- |
| `ocre` | readable-only legacy palette; do not expose as new choice |
| `pierre` | readable-only legacy palette; do not expose as new choice |
| `bordeaux` | readable-only legacy palette; do not expose as new choice |
| `encre` | readable-only legacy palette; do not expose as new choice |

Do not auto-map legacy palettes to modern named palettes during migration unless a separate design decision defines exact visual equivalence.

### Phase 12 — Observability and active/legacy boundaries

Add lightweight migration/debug observability following existing project patterns:

- log or trace when a legacy proposal `templateBundleId` is inferred as Style 1/2/3;
- log or trace when invalid font/palette/template values are sanitized;
- expose development/test-only resolved style source for debugging;
- avoid broad user-facing analytics unless an existing analytics path already covers it.

Implementation boundaries:

- Active code to change: `SettingsPage.tsx`, `proposalSettings.ts`, `CvForge.tsx`, `CvRail.tsx`, `ProposalForge.tsx`, `ProposalRail.tsx`, storage/adapters/resolvers/export tests.
- Before editing any named file, verify it exists and is on the active v1 read/write path. If a listed file is absent or not active, update the implementation target list rather than creating compatibility code around dead paths.
- Compatibility-only code/data to preserve: legacy palette ids, `styleChoice`, `templateBundleId`, embedded `resumeTemplateId` in `VerbatiStylePreset`.
- Obsolete/dead unless reactivated: `ProposalForgeNext.tsx` and `/proposal-next`.

### Phase 13 — Acceptance criteria

Implementation is complete when:

1. Settings Style 1/2/3 hydrate from one shared factory contract.
2. Existing CV/proposal documents render unchanged.
3. New documents use Settings defaults according to the decided creation semantics.
4. Existing CV style application never changes template.
5. Proposal never adopts CV two-column geometry.
6. Custom-state labels are stable and explainable after Settings changes.
7. Preview, print, PDF export, and DOCX export use the same resolved snapshot/fallback contract.
8. Local drafts, Convex rows, public projections, and profile restores round-trip slot identity/base snapshots.
9. No document metadata is mutated by merely opening a document or saving Settings.
10. Reset updates both the current render snapshot and base snapshot according to the chosen reset source, so a reset document does not remain incorrectly marked custom.

### Phase 14 — Tests required before implementation is considered complete

Shared resolver/unit tests:

- factory defaults hydrate Style 1/2/3 when no saved preset exists;
- Settings slot overrides factory defaults;
- invalid font/palette/template values sanitize to supported defaults;
- slot-to-proposal-bundle compatibility maps Style 1/2/3 deterministically;
- CV comparison ignores template while Proposal comparison ignores CV-only fields.

Settings tests:

- factory defaults hydrate Style 1/2/3 when no saved preset exists;
- saved slot overrides factory defaults;
- signature settings remain part of Settings slot;
- active default slot persists with the chosen shared-or-per-surface semantics;
- existing `proposalPreset1/2/3` data remains readable.

CV Forge tests:

- Style 1/2/3 applies typography/palette/accent from Settings/factory;
- selecting Style 2 does not change current `resumeTemplateId`;
- Template buttons change only template identity;
- changing font/color after selecting a style shows `Style N · Custom`;
- changing Template after selecting a style does not mark style custom;
- Reset restores the selected base visual style while preserving the current CV template;
- export/print still render from resolved `verbatiStyle` and explicit template id.

Proposal Forge tests:

- Style 1/2/3 maps to proposal-compatible one-layout style;
- selecting a style preserves a base id;
- font/color override shows `Style N · Custom`;
- named palettes persist as named palette ids;
- arbitrary picker colors persist as `custom + accentHex`;
- fixed non-palette accent choices, if retained, persist as deliberate custom accents and are not confused with named palettes;
- Reset restores the selected base visual style while preserving proposal content/job context/one-layout renderer;
- saved/reopened proposal uses persisted `verbatiStyle` over attached CV fallback when proposal is local/custom.

Migration/read-compat tests:

- old CV with only `metadata.verbatiStyle` renders correctly;
- old CV with embedded `resumeTemplateId` renders and does not lose template on style migration;
- CV `saveMetadataPatch(...)` persists `verbatiStyleSlotId/source/nameSnapshot`, `verbatiStyleBaseSnapshot`, and `documentStyleVersion` alongside `verbatiStyle`;
- old proposal with only `templateBundleId` resolves the visible compatibility style when exact;
- old proposal with only `metadata.verbatiStyle` renders correctly;
- local proposal output draft save/restore preserves slot identity/base snapshot/custom state across refresh;
- legacy palette ids stay readable and are not exposed as new choices;
- opening an old document does not persist inferred slot ids until explicit save/style selection;
- reopened documents behave predictably after Settings slot values change.

Cross-surface tests:

- Settings Style 2 can default new CVs to Workshop 2-col, but applying Style 2 to an existing one-column CV preserves one-column unless the Template control changes it;
- new CV/proposal creation uses Settings/factory defaults according to the decided semantics;
- CV/proposal duplication preserves snapshots, slot identity, base snapshot, and custom state without re-resolving against Settings;
- Settings changes do not mutate existing documents and do not destabilize custom labels;
- Proposal never receives a two-column CV template as its layout;
- preview/print/PDF/DOCX work with slot identity absent and present;
- legacy saved documents without style slot id still render correctly.

### Phase 15 — Verification commands later

When implementation eventually happens, run narrow checks first. Verify listed paths still exist and are on the active v1 path before using exact commands; if a listed test file does not exist, add or update the narrowest relevant test under the nearest active test directory.

```bash
cd my-app && rtk npx tsc --noEmit --pretty false
cd my-app && rtk npx vitest run src/pages/__tests__/SettingsPage.preview.test.tsx
cd my-app && rtk npx vitest run src/pages/__tests__/CvForge.workspace-mode.test.tsx src/pages/__tests__/CvForge.export-status.test.tsx
cd my-app && rtk npx vitest run src/components/proposal/__tests__/ProposalRail.style.test.tsx
cd my-app && rtk npx vitest run src/lib/__tests__/proposal-template-bundles.test.ts src/lib/__tests__/proposal-style-choice.test.ts src/lib/__tests__/proposal-render-state.test.ts
cd my-app && rtk npx vitest run src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.export.behavior.test.tsx src/pages/__tests__/ProposalPrintPage.test.tsx src/pages/__tests__/ResumePrintPage.test.tsx
cd my-app && rtk npx vitest run src/lib/__tests__/document-export-models.test.ts src/lib/__tests__/exportDocumentFile.test.ts convex/lib/__tests__/userProfileMetadata.test.ts convex/lib/__tests__/userProfileMetadataSchemaAlignment.test.ts
```

For rendered UI changes, add a browser-backed check for:

- CV rail Style and Template controls remain separate;
- Style custom label appears after font/color override;
- Template toggle does not change style slot;
- Proposal style still shows `Style N · Custom` after override;
- Proposal remains one-layout regardless of CV two-column template.

## Open product decisions before code

1. Confirm actual factory defaults for Style 1/2/3.
2. Confirm whether Style 2 defaulting to Workshop 2-col applies only to new CVs. Recommended: yes, new CV defaults only.
3. Confirm whether Settings has one active default slot for all new docs or separate CV/proposal defaults.
4. Confirm whether CV should ever use proposal signature/voice settings. Recommended: no for rendering/comparison.
5. Confirm whether the five existing proposal bundle ids should be reduced/classified or kept internal.
6. Confirm Reset target semantics: current Settings slot vs factory slot, and whether proposal signature/voice need separate reset controls.
7. Confirm that selected style slot persists as `verbatiStyleSlotId` on both CV and proposal metadata, with proposal `templateBundleId` retained only as a compatibility alias.
8. Confirm `verbatiStyleBaseSnapshot` and `documentStyleVersion` as part of the non-MVP metadata model for stable custom labels and future migrations.
9. Confirm proposal document `verbatiStyle` snapshot shape: current minimal `{ layout, typography, palette, accentHex }` vs full `familyId` support in Convex validators.
10. Confirm new document/duplicate/import defaulting semantics before UI wiring.
