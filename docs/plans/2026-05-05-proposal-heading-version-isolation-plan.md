# Proposal heading version isolation plan

## Problem

Proposal headings are still behaving like shared workspace state in proposal-library and saved-proposal surfaces.

Users expect heading values to work like proposal versions:

- defaults come from profile, proposal settings, or PDF/CV import when a new proposal/draft is created;
- the Heading tab can override those defaults for one proposal only;
- once overridden, that proposal keeps its own heading snapshot across autosave, Save/Finalize, reload, duplicate-to-draft, export, and print;
- changing a heading in one proposal must not repaint or export through another library item.

## Fresh code findings that shape this plan

This is active `v1` code.

- `ProposalRail` is presentational. It renders `variableFields` for Heading (`proposal-subject`, `applicant-name`, `applicant-role`, `contact-line`, `letter-date`, `recipient-details`, `salutation`) but does not own proposal ids or persistence.
- `ProposalForge` owns heading state, Heading-tab callbacks, autosave/save snapshots, saved-view restore, draft restore, duplicate-to-draft, and export sources.
- `ProposalInputForm` currently performs the immediate post-generation server update (`content`, `sections`, `status: "draft"`) after receiving `result.proposalId`, so generated-row heading metadata patching must account for that boundary too.
- Convex proposal metadata already supports row-local fields for `applicantName`, `applicantRole`, `contactLine`, `letterDate`, `recipientDetails`, and header visibility booleans.
- Subject is currently the proposal `title` / `proposalDocumentTitle`, not a separate metadata field. Create/update mutations normalize blank titles back to a generated or previous title, so subject clear behavior must be defined explicitly.
- Salutation is embedded in proposal `content`; it is read/replaced from the body, not stored as standalone metadata.
- `StoredProposalOutputDraft` is a single workspace/session recovery draft, not a per-row store. It may only be used for the active compose/recovery path when its `generatedProposalId` matches the active proposal id; library/saved/export rows should not read it as a display source.
- `ProposalsList` currently falls back to `activeApplicantHeader` for saved rows, which is the clearest library bleed-through boundary.
- `ProposalDisplay` and `ProposalDocumentRenderer` also use `||` fallback chains for `railTitle`, `railMeta`, `applicantHeader`, `documentTitle`, `documentMeta`, and sender contact data; explicit blank values can still be replaced downstream unless render props become presence-aware. The compose preview path also passes `proposalApplicantName || null`, `proposalContactLine || null`, etc., so explicit clears can be erased before save, not only in saved/library views.
- Saved export/print in `ProposalForge` currently builds saved applicant headers with `defaultPreviewApplicantHeader`, which can also leak live profile/default data into an existing saved proposal. Both `exportSavedProposalSource` and `exportSavedStyledProposalSource` are affected.
- Opening a server-backed draft currently risks writing the previously active heading state back into the output draft if hydration does not explicitly use that draft row’s metadata.
- Current auto-default effects in `ProposalForge` refill empty applicant/contact/date/recipient fields from defaults when defaults change; those effects must not override explicit clears or row-owned heading state after a proposal id exists.
- Duplicating a saved proposal to draft clones metadata server-side, but the in-memory compose heading state also needs to be hydrated from the saved row, not left at current workspace defaults.
- Clearing a heading field must be represented explicitly. Existing update mutations shallow-merge metadata, so omitted fields do not clear old values. Subject/title is a special case: create/update title paths normalize blanks to a generated or previous title, so subject should remain required/non-empty in this plan unless separate subject storage is added.

## Core insight

Treat heading data as proposal-local version state, not as a global applicant header.

There are three different resolver contexts and they must not be collapsed:

1. **New-proposal seed context**
   - May use profile/settings/PDF import/current CV defaults.
   - Used only when creating or resetting a new proposal/draft.

2. **Existing-proposal library/saved/export context**
   - Must resolve from the proposal row first.
   - Must not read `StoredProposalOutputDraft`, even if ids happen to match, because local recovery cache must not repaint library/saved/export surfaces.
   - May use row-owned legacy evidence (`title`, `content`, `sections`, already stored metadata) and safe placeholders.
   - Must never use the current active profile/settings/CV header as a fallback for library rows, saved view, saved export, saved print, or an unrelated draft row.

3. **Active compose/recovery context**
   - Starts from the active in-memory compose heading state.
   - On explicit `/proposal?draftId=...` open, hydrate from that server draft row first.
   - May use `StoredProposalOutputDraft` only as recovery for the same `generatedProposalId` when it is the active compose draft, not for library display.

## Heading snapshot contract

Introduce one explicit resolver contract, likely in `my-app/src/lib/proposal-heading-state.ts`.

The resolver should return a normalized row-local shape for current rendered headings:

- `documentTitle` — backed by proposal row `title` / compose `proposalDocumentTitle`; treat as required/non-empty unless a separate subject field is added, because current create/update title paths cannot persist blank titles.
- `applicantName` — backed by `metadata.applicantName`.
- `applicantRole` — backed by `metadata.applicantRole`.
- `contactLine` — backed by `metadata.contactLine`.
- `letterDate` — backed by `metadata.letterDate`.
- `recipientDetails` — backed by `metadata.recipientDetails`.
- `headerVisibility` — backed by the five `headerShow*` metadata fields, with content-derived defaults only when those fields are absent.
- `salutation` — read from proposal content when needed; writes update the content body.
- `fieldPresence` / explicit-clear flags — required for renderer/export handoff so downstream `ProposalDisplay` / `ProposalDocumentRenderer` can distinguish absent legacy fields from intentionally blank fields. At minimum, include presence for applicant name, applicant role, contact line, letter date, recipient details, and subject/title non-empty requirement.
- `source` diagnostics — useful so tests can distinguish `row`, `activeComposeRecovery`, `legacySafeFallback`, and `newProposalDefaults`.

### Explicit blank semantics

This is not optional. Users must be able to intentionally clear a field without old metadata or live defaults reappearing.

- Treat `undefined` / absent metadata as “unknown legacy value”.
- Treat `""` as “explicitly cleared”.
- Do not use `||` for heading fallback in resolver, display, renderer, or export paths. Use presence checks (`hasOwnProperty`) plus normalization so empty strings remain meaningful clears.
- The current auto-default synchronization effects must also use this ownership signal: empty string means explicit clear once the field is user-edited or row-owned, not “please refill from defaults.”
- When persisting after a Heading edit, include all metadata-backed heading fields in the metadata patch, including empty strings for cleared text fields. Do not rely on helpers such as `normalizeSavedTextValue` in a way that converts explicit `""` clears back into missing values for saved cards.
- Include all five header visibility booleans after a visibility edit or save snapshot, including values that equal defaults, so old booleans cannot survive shallow merges.
- If a future implementation chooses `null` instead of `""`, update Convex validators and all public/internal proposal metadata validators together. The proposal metadata validator/projection shape is duplicated or mirrored in `schema.ts`, `createProposalPublic.ts`, `updateProposalPublic.ts`, `proposals.ts`, `proposalsPublic.ts`, and `types/schema.ts`; do not change only one of them. Otherwise prefer `""` because existing validators already allow strings.

## Proposed changes

### 1. Add a proposal-heading resolver layer

Add a helper that resolves heading data for one specific proposal row or one compose draft snapshot.

Required resolver modes:

- `resolveNewProposalHeadingSeed(defaults)`
  - Profile/settings/PDF/current CV defaults are allowed.
  - Used by Generate/start/reset flows only.

- `resolveLibraryProposalHeading(row)`
  - Uses row metadata/title/content only.
  - Ignores `StoredProposalOutputDraft` and all active workspace state.
  - Uses safe placeholders or empty values for missing legacy fields.
  - Must not read `activeApplicantHeader`, `defaultPreviewApplicantHeader`, current CV, profile, settings, or PDF import defaults.

- `resolveActiveComposeHeading({ row?, storedOutputDraft?, currentState })`
  - Uses current in-memory compose state while the user is editing.
  - On explicit server-backed draft open, hydrates current state from the server row before writing recovery storage.
  - Uses `storedOutputDraft` only when `storedOutputDraft.generatedProposalId` matches the active generated proposal id and the path is a compose recovery path.

- `buildProposalHeadingMetadataPatch(snapshot)`
  - Emits every persisted metadata-backed heading key, including explicit blank strings and visibility booleans.
  - Does not emit subject/title as metadata unless separate storage is added.
  - Keeps subject/title and salutation/content in their existing storage locations.

- `buildProposalHeadingRenderProps(snapshot)` or equivalent
  - Produces render/export props that are already presence-aware.
  - Prevents explicit blanks from being converted to `null` before `ProposalDisplay` / `ProposalDocumentRenderer`.
  - Either passes `applicantHeader: null` for explicitly cleared sender/contact fields or passes explicit field-presence flags consumed downstream.

### 2. Persist heading overrides on the proposal row being edited

`ProposalForge`, not `ProposalRail`, should own this.

- Heading-tab field callbacks may stay in `ProposalForge` and be passed to `ProposalRail` as `variableFields`.
- On blur/autosave/Save/Finalize, build the metadata patch from the active proposal heading snapshot. In `proposalPersistenceMetadata`, replace truthy heading guards with snapshot emission for all metadata-backed heading fields, including `""`.
- Save/Finalize must keep the chosen proposal id and heading snapshot together.
- If a generated proposal row already exists, updates must patch that row in place. When generation returns a `proposalId`, immediately patch that row with the complete heading metadata snapshot instead of relying only on a later blur/autosave. Coordinate with `ProposalInputForm` because it currently owns the immediate post-generation `updateGeneratedProposal` call that marks the row as `draft` but does not send metadata.
- Do not write Heading-tab edits to profile, proposal settings, imported CV/PDF defaults, or active personalization sources.

### 3. Hydrate existing rows from their own metadata before rendering or editing

Required active code paths:

- **Open server-backed draft** (`/proposal?draftId=...`): compute one `draftHeadingSnapshot` from `draftProposal.metadata` / title / content; set `proposalApplicantName`, `proposalApplicantRole`, `proposalContactLine`, `proposalLetterDate`, `proposalRecipientDetails`, `proposalHeaderVisibility`, and `proposalDocumentTitle` from that snapshot before writing `StoredProposalOutputDraft`; use that same local snapshot in `writeStoredOutputDraft`, not stale React state variables from the previously active proposal. Do not write the output draft until those local snapshot values have been computed.
- **Open saved proposal** (`/proposal?view=saved&id=...`): saved display, saved export, and saved duplicate-to-draft must use the saved row’s heading snapshot. Do not merge in `StoredProposalOutputDraft` for saved view. Apply the same resolver to authenticated rows and guest/local fixture rows loaded through `readStoredSavedProposalFixtures()`.
- **Duplicate saved to draft**: clone the saved row’s heading metadata into the new draft row and hydrate in-memory compose heading state (`proposalApplicantName`, `proposalApplicantRole`, `proposalContactLine`, `proposalLetterDate`, `proposalRecipientDetails`, `proposalHeaderVisibility`, and `proposalDocumentTitle`) from the same saved row snapshot. Await or otherwise sequence the created draft id before writing output-draft/autosave identity; do not immediately reset `generatedProposalId` to `null` after firing an async create.
- **Autosave recovery**: only use `StoredProposalOutputDraft` as active compose recovery data when its `generatedProposalId` matches the active draft/proposal id. Otherwise it remains recovery cache only. It must never be a Proposal Library, saved view, or export data source.

### 4. Render Proposal Library from row-local heading state only

Update `ProposalsList` as the primary library boundary, including authenticated server rows and guest/local fixture rows from `readStoredSavedProposalFixtures()`.

- Remove `activeApplicantHeader` / current personalization fallback from saved-row `railTitle`, `railMeta`, `applicantHeader`, and preview card rendering.
- Do not use `normalizeSavedTextValue` for heading fields because it converts `""` into `null`; use a heading-specific own-property normalizer that preserves explicit blanks.
- Ensure the selected saved card and secondary saved cards use the same row-local resolver semantics, including explicit blank values.
- Use the resolver for the selected card and secondary cards.
- Replace or bypass `ProposalDisplay` and `ProposalDocumentRenderer` fallback chains for heading fields with a concrete presence-aware contract. An implementation may either pass a render-ready heading object that bypasses fallback chains, or add explicit field-presence props; do not leave this as a best-effort audit. If applicant name/role/contact is explicitly blank, downstream renderers must not replace it with `applicantHeader`, `documentTitle`, `documentMeta`, generated placeholders, or profile-derived sender data.
- If row metadata is missing, use row-owned safe values (`proposal.title`, content-derived salutation where appropriate, or blank/placeholder) rather than live defaults.
- Keep Draft/Saved labeling from the proposal lifecycle work unchanged.

`Sidebar` and `DocumentsPage` should be audited but only changed if they render heading/header values or reuse heading-preview helpers. Do not add churn there if they only display proposal title/status/navigation.

### 5. Fix saved export / print and refine/regenerate sources

Saved proposal export is part of the same product contract, not a separate nice-to-have.

- Replace saved export applicant/header construction in both `exportSavedProposalSource` and `exportSavedStyledProposalSource` with the row-local resolver.
- Ensure `ProposalForge` saved toolbar actions, guest/local fixture saved view, and the `ProposalsList` selected-card preview resolve the same selected row to the same heading snapshot.
- Do not spread `defaultPreviewApplicantHeader` into saved export headers.
- If `contactLine` is missing on a legacy row, do not rebuild it from current profile defaults. Use blank/placeholder or row-owned legacy evidence.
- Ensure styled PDF, ATS PDF, and DOCX export paths all use the same resolved saved snapshot. Styled print `railTitle`/`railMeta` and sender/contact data must preserve explicit blanks rather than falling back to profile defaults.
- Proposal Library refine/regenerate (`handleRegenerate`) must clone the selected row’s heading snapshot into the regenerated proposal row. The generation payload may still use the selected job/content context, but persisted/rendered heading metadata for the new version must not come from the active profile/current CV unless the user explicitly starts a new proposal.

### 6. Resolve legacy rows at read/render time without global mutation

For legacy rows missing heading fields:

- Prefer row-owned data only: proposal `title`, existing `metadata`, `content`, and `sections`.
- Preserve Convex public projection behavior that uses nullish coalescing (`?? undefined`) for heading fields; do not replace it with truthy checks (`|| undefined`) because `""` is a valid explicit clear.
- Do not infer from the current live workspace, current CV, current profile, proposal settings, or imported PDF defaults.
- Do not write inferred values back just because the user opened or viewed a different proposal.
- If a user edits/saves a legacy row, persist a complete heading snapshot at that point.

### 7. Keep defaults as defaults

Profile/settings/PDF import remain sources for new proposals only.

- Generate/start/reset can still seed heading fields from defaults.
- Once a proposal is generated, opened, edited, duplicated, autosaved, or saved, the version’s row-local snapshot owns its heading values.
- Global defaults may affect future proposals, not existing library rows.

## Files likely to change

Plan for source work later only; do not implement in this review pass.

- `my-app/src/lib/proposal-heading-state.ts` — new resolver/metadata-patch helper.
- `my-app/src/pages/ProposalForge.tsx` — heading state owner; compose render handoff; draft hydration; saved export; duplicate-to-draft; save/autosave metadata patches.
- `my-app/src/components/ProposalInputForm.tsx` — either include heading metadata in the immediate generated-row update or defer that update so `ProposalForge` can patch content/status/metadata atomically after `proposalId` returns.
- `my-app/src/components/ProposalsList.tsx` — remove active-header fallback from saved/draft row rendering and use resolver.
- `my-app/src/components/ProposalDisplay.tsx` and `my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx` — make heading/render fallback handling presence-aware so explicit blanks are not replaced by internal `||` fallback chains.
- `my-app/src/lib/proposal-output-draft.ts` — expose/normalize recovery snapshot fields if needed; keep it clearly single-workspace and id-matched.
- `my-app/convex/createProposalPublic.ts`, `my-app/convex/updateProposalPublic.ts`, `my-app/convex/proposals.ts`, `my-app/convex/proposalsPublic.ts`, `my-app/convex/schema.ts`, and `my-app/convex/types/schema.ts` — only if explicit blank/null or additional per-proposal heading fields require validator/schema/type changes. Treat `types/schema.ts` as generated/typed mirror if it is generated; otherwise audit it too.
- `my-app/src/components/proposal/ProposalRail.tsx` — likely no behavior change; update only if labels/help text need to clarify proposal-local editing.
- `my-app/src/components/Sidebar.tsx` and `my-app/src/pages/DocumentsPage.tsx` — audit-only unless they display/reuse heading data.

## Rejected alternatives

- **One global heading state for all proposals** — rejected because it recreates the bleed-through bug.
- **Use profile/settings/current CV fallback for existing library rows** — rejected because it makes old rows repaint when defaults change.
- **Clone a new proposal on every heading edit** — rejected because it destroys version continuity and makes Save/Finalize messy.
- **Hide headings in the library/export and only show them in the editor** — rejected because users need to compare and send/export versions with confidence.
- **Rely on renderer placeholders for explicit clears** — rejected because placeholders are useful for empty legacy data but must not override a user’s deliberate blank field.
- **Treat localStorage output draft as per-row storage** — rejected because the storage key is global and only safe for active compose recovery when its proposal id matches.

## Non-goals

- No heading UI redesign.
- No rewrite of generation prompts.
- No change to draft/saved lifecycle semantics.
- No broad migration job unless read-time legacy handling is proven insufficient.
- No revival of legacy `/proposal-next` behavior.

## Verification plan

Add focused regressions before or alongside implementation.

1. **Library row isolation**
   - Given two proposal rows with different `metadata.applicantName`, `metadata.applicantRole`, `contactLine`, `letterDate`, and `recipientDetails`, the selected and secondary cards render their own values.
   - Changing active profile/current CV defaults does not change those rendered saved rows.
   - Guest/local fixture saved proposals go through the same resolver and do not use active profile/current CV fallback.

2. **Missing-metadata legacy row safety**
   - Given a saved row missing heading metadata and an active profile with different heading values, the library and saved view do not show the active profile values.
   - The row uses title/blank/safe placeholder only.

3. **Explicit clear semantics, render fallback, and auto-default sync**
   - Clearing applicant name/applicant role/contact line/date/recipient details persists an explicit blank and does not restore the old metadata or live defaults after reload.
   - The selected saved card and secondary saved cards both keep cleared applicant fields blank instead of falling back through `normalizeSavedTextValue` to active profile data.
   - Compose preview, selected saved card, secondary saved card, `ProposalDisplay`, and `ProposalDocumentRenderer` do not replace explicitly blank applicant name/role/contact fields with `applicantHeader`, `documentTitle`, `documentMeta`, or generated placeholder text.
   - Toggling header visibility back to default still overwrites any old stored booleans.
   - Subject/title is not expected to clear to blank unless separate subject storage is added; if it remains row `title`, assert exact behavior: clearing subject locally either reverts to the previous title on blur or persists a safe non-empty generated title, consistently across compose, saved view, duplicate, and export.
   - After clearing applicant/contact/date/recipient fields, changing active CV/profile/proposal-setting defaults does not refill those cleared fields while editing the same proposal row.

4. **Server-backed draft hydration and default changes**
   - Opening `/proposal?draftId=A` hydrates compose heading state from draft A’s metadata.
   - Opening draft B afterwards does not carry A’s heading state.
   - Opening draft A, changing profile/defaults, then opening draft B does not let the auto-default effects overwrite either draft’s row-owned heading values.
   - The output-draft recovery cache is used only for the matching `generatedProposalId` in the active compose recovery path, and is ignored by library/saved/export rendering.

5. **Save/Finalize preservation**
   - Editing Heading on draft A then Save/Finalize promotes A in place with the same heading snapshot.
   - Proposal B remains unchanged.

6. **Duplicate saved to draft**
   - Duplicating saved proposal A creates a new draft row carrying A’s heading metadata.
   - The compose editor immediately displays A’s duplicated heading values, not current profile defaults.
   - The output-draft recovery snapshot and autosave identity use the new draft id, not `null` or the original saved id.

7. **Saved export/print/refine isolation**
   - Exporting saved proposal A uses A’s stored heading snapshot.
   - Changing the active profile/settings/CV before export does not change the exported sender/contact/date/recipient values.
   - Saved styled PDF `railTitle`/`railMeta`, ATS PDF source, and DOCX source all preserve explicit blank values from the row snapshot.
   - Refining/regenerating a saved proposal copies the selected row’s heading snapshot to the regenerated row even when the active profile/current CV has different defaults.

8. **Immediate generation row patch, subject, and salutation**
   - When generation returns a `proposalId`, the generated server row receives content, `status: "draft"`, and the complete heading snapshot immediately, before any manual blur or later autosave.
   - Editing the Heading tab subject updates the proposal title/document title for that proposal only.
   - Editing salutation updates only that proposal’s content and survives save/reload/duplicate.

Suggested test files:

- `my-app/src/components/__tests__/ProposalsList.*.test.tsx` for library row rendering.
- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx` for saved view and saved export behavior.
- `my-app/src/pages/__tests__/ProposalForge.draft-persistence.test.tsx` for draft hydration and output-draft matching.
- `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx` for Save/Finalize metadata preservation.
- `my-app/src/pages/__tests__/ProposalForge.preview-header.test.tsx` or renderer-focused tests for compose render handoff and explicit blank preservation.
- Add a small unit test for the new resolver helper if it is introduced.

## Implementation order

1. Add failing tests for active-header bleed-through in `ProposalsList`, saved export, compose preview explicit blank preservation, auto-default explicit-clear behavior, and immediate generated-row heading metadata patching.
2. Add resolver/helper and unit-test the three contexts: new-proposal seed, library/saved/export row resolve, and active compose/recovery resolve.
3. Update `ProposalsList` to stop passing active headers into saved row previews and refine/regenerate heading metadata.
4. Update compose preview handoff and `ProposalDisplay` / `ProposalDocumentRenderer` fallback handling so explicit blanks survive renderer/export boundaries.
5. Update saved export/print sources to use the same row-local resolver.
6. Update draft-open and duplicate-to-draft hydration in `ProposalForge`.
7. Update save/autosave metadata patching to include explicit blanks and visibility booleans; remove truthy guards for metadata-backed heading fields.
8. Run the focused Proposal Forge / ProposalsList suites, then TypeScript.

## Open decisions before implementation

- Should explicit clears be represented as empty strings using existing validators, or should metadata validators expand to allow `null`? Recommendation: use empty strings first because it is compatible with current validators.
- Do we need granular per-proposal applicant contact fields (`email`, `phone`, `linkedin`, `website`, `location`, `tag`) beyond the existing `contactLine` snapshot? Recommendation: avoid schema expansion unless a current renderer/export path cannot be made correct with `contactLine` plus `applicantName`/`applicantRole`.
- Should legacy rows get a one-time background migration later? Recommendation: not for this fix; resolve safely at read time and persist a complete snapshot when the user edits/saves that row.
- Should renderer props grow explicit field-presence flags, or should the resolver produce a render-ready object that bypasses fallback chains? Recommendation: prefer a render-ready heading object/helper first, and add props only if existing component contracts cannot preserve explicit blanks cleanly. Whatever route is chosen must cover compose preview, saved cards, saved export, and print.
