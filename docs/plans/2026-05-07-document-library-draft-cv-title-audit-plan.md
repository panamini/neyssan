# Document Library / Draft / CV Title Audit Plan

Date: 2026-05-07
Scope: active `v1` paths only. No product code changes planned in this pass.

## Goal

Audit why proposal drafts appear in the document library, how a draft becomes a saved document now that the manual save button was removed/changed, whether CV Forge has an autosave/draft lifecycle as strong as Proposal Forge, and why CV library titles do not update when profile/job fields change.

## Assumptions

- The active app path is `my-app/` and the active routes are `/proposal`, `/documents`, `/proposals`, `/cv`, and `/cvs`.
- Proposal Library and Documents should be judged against the newer docs that say proposal library can surface both server-backed `draft` and `saved` rows.
- A CV title is a document/library title, not necessarily a live projection of the user name or job target.
- Existing user/worktree changes must not be touched.

## Smallest safe change

This audit phase should not patch production code. It should produce a concrete findings report and a follow-up fix plan with tests. If a fix is approved later, the smallest likely changes are UI labeling/rename affordances and tests around the proposal draft/saved lifecycle and CV title behavior.

## Verification

- Read required project instructions and wiki routing pages.
- Read targeted wiki/docs for Job Library, Product Vision/Roadmap, PR2 Proposal Forge, PR4 CV Forge, PR5 Documents, and prior proposal/CV persistence audits.
- Inspect active code paths in `my-app/src` and `my-app/convex`.
- No browser/runtime verification in this plan pass unless the user asks to continue from plan to implementation/audit execution.

## Confirmed audit findings so far

### 1. Why proposals appear in Documents even when not saved

This is active code.

`my-app/convex/proposalsPublic.ts` now explicitly returns both `status === "draft"` and `status === "saved"` rows. `my-app/src/pages/DocumentsPage.tsx` consumes that query and maps `status: "draft"` rows to document cards with `kind: "draft"`, `eyebrow: "Draft"`, and `status: "Draft"`.

So the current reason is not a bug in filtering alone: the current implementation intentionally treats server-backed proposal drafts as library-visible documents. This matches the revised plan in `docs/plans/2026-05-05-proposal-save-autosave-library-fix-plan.md`, which says Proposal Library owns both server-backed draft proposals and saved proposals.

Risk: the mental model may still be unclear because `/documents` says “Proposals, CVs, and drafts” but older `/proposals` still filters to saved only in `my-app/src/pages/ProposalsLibrary.tsx`. This creates two different library semantics.

### 2. How a proposal draft becomes saved

This is active code.

Generation path:

- `my-app/convex/generateProposalMutation.ts` creates a proposal row with `status: "pending"`.
- `my-app/src/components/ProposalInputForm.tsx` patches that generated row to `status: "draft"` after generation.
- `my-app/src/pages/ProposalForge.tsx::handleProposalSubmit` also patches the returned proposal id with content, sections, metadata, and `status: "draft"`.
- Autosave in `ProposalForge.tsx` keeps using the current `generatedProposalId` as the active draft identity.

Save/finalize path:

- `ProposalForge.tsx::handleSaveOutputToLibrary` calls `flushScheduledProposalSave(..., { status: "saved" })` for an existing generated id, or creates a new saved row if no id exists.
- After successful save, it clears `dasti:proposal-output-draft:v1`, clears compose draft storage, resets `generatedProposalId`, and navigates back to `/proposal` without `draftId`/`id` params.

So “draft becomes saved” means status promotion in Convex from `draft` to `saved`, not a separate manual local-only action.

Open question: if the manual save button was removed from the visible UI, the code path may still exist but may no longer be discoverable. A browser check is needed to confirm the actual button/label currently visible in the rendered app.

### 3. Proposal saved/draft state is stronger than CV state

This is active code.

Proposal Forge has an explicit server-side lifecycle: `pending -> draft -> saved`, a `draftId` route, server-backed draft listing, draft hydration, saved-view isolation, duplicate-to-draft logic, and tests around autosave/draft/save behavior.

CV Forge/CV Library uses a different model:

- There is no `draft` vs `saved` CV status field in the active `CvDocument` model.
- `my-app/src/contexts/CvLibraryContext.tsx` autosaves every meaningful current CV into local cache and remote profile storage.
- The library index is written to localStorage whenever `cvs` changes.
- Remote save is debounced via `scheduleSave(currentCv)` when dirty.
- CVs are therefore “autosaved documents,” not proposal-style “draft rows that later become saved rows.”

Conclusion: CV autosave is durable, but it does not have the same explicit state machine or user-facing draft/saved boundary as Proposal Forge.

### 4. Why CV title does not update after changing user/job fields

This is active code and appears intentional from tests.

`my-app/src/lib/normalize-cv.ts` derives placeholder titles from profile section fields: `name`, `desiredPosition`, then email. `my-app/src/contexts/CvLibraryContext.tsx::applyAutoTitleIfPlaceholder` only changes a CV title when the existing title is a placeholder (`Untitled CV...` or `Imported CV...`).

Tests confirm this policy:

- `CvLibraryContext.test.tsx` expects editing profile fields on a placeholder CV to update title to `Jane Doe — Product Manager`.
- It also expects a manually renamed title (`My Custom CV`) to be preserved after profile metadata changes.

Therefore, once a title is non-placeholder/manual, changing the user name, desired position, or job content will not rename the CV library card. That is why the library title can remain unchanged even though the CV content changes.

### 5. Current CV rename affordance is weak/inconsistent

This is active code.

There is a `CvRenameDialog` component and `renameCv` context action, but current visible entry points are narrow:

- `ProfileReviewCard.tsx` opens the rename dialog only in import-related flows when `shouldPromptForImportedTitleRename(...)` triggers.
- `CvsLibrary.tsx` cards expose open and delete, but no rename action.
- `CvForge.tsx` imports/uses title derivation but no obvious manual rename entry point was found in the inspected code snippets.

This explains the user-facing confusion: the data model supports manual rename, but the primary CV library/forge UI does not make renaming obvious.

## Risks / open questions needing browser verification

- Whether `/proposal` still exposes “Save proposal to library” or whether the button was removed from the visible toolbar in the current rendered UI.
- Whether `DocumentsPage` draft cards are clearly labeled enough to explain “this is an autosaved draft, not finalized.”
- Whether `/proposals` saved-only semantics and `/documents` draft+saved semantics are intentional long-term or transitional.
- Whether CV Forge topbar/title area has a hidden rename interaction not visible from static search.

## Brainstorm recommendation

### Proposal lifecycle recommendation

Do **not** automatically promote proposal drafts to saved just because autosave ran.

Reason: generation often creates several exploratory variants. Autosave should protect work, but “Saved” should still mean “this is a document I intentionally keep/finalize.” If every draft auto-promotes to saved, the library will become noisy and users lose the useful distinction between work-in-progress and finished proposal.

Best product model:

- **Draft** = autosaved generated/editable proposal variant, visible in Documents/Proposal Library with a clear Draft chip.
- **Saved / Finalized** = user intentionally kept it as a library document.
- **Autosave** = always on, protects both drafts and saved docs.

Recommended UI change: add back a visible action, but rename it away from a vague manual save button.

Preferred labels:

1. **Finalize** — strongest if the product wants a clear draft-to-saved boundary.
2. **Save to library** — clearest for mainstream users.
3. **Keep this version** — good if generated variants are common.

My recommendation: use **“Save to library”** in the primary UI, with helper copy: “Autosaved as draft. Save to library when this version is ready.”

This avoids implying that autosave is missing. The button is not for protection; it is for changing lifecycle state from Draft to Saved.

### Proposal library recommendation

Keep drafts visible, but separate them clearly:

- Documents tab: All / Proposals / CVs / Drafts is good.
- Proposal Library should not silently mean saved-only if Documents means draft+saved. Either:
  - make Proposal Library show two sections: **Drafts** and **Saved**, or
  - rename saved-only `/proposals` copy to “Saved proposals.”

Minimum improvement: every proposal card should show an obvious chip: `Draft` or `Saved`, plus a short subtitle such as “Autosaved draft” vs “Saved to library.”

### CV Forge lifecycle recommendation

Do **not** add proposal-style draft/saved status to CV Forge right now.

Reason: the current CV behavior matches the user’s mental model: every text/style edit autosaves and the CV remains a living document. Adding a Draft/Saved boundary to CVs would create unnecessary friction and could make users wonder whether their CV changes are protected.

Keep CV Forge as:

- always-autosaved document;
- style and text saved automatically;
- no required Save button for normal edits.

What CV Forge does need is not a draft system. It needs a clearer **Rename** affordance and title policy.

Recommended CV title model:

- Auto-title only for placeholder titles (`Untitled CV`, `Imported CV`).
- Once the user has a custom title, preserve it.
- Add visible rename actions in:
  - CV Library card menu: `Rename`, `Duplicate`, `Delete`;
  - CV Forge title/topbar: click title or menu item `Rename resume`.

Optional later enhancement: a small command “Update title from profile” that sets `Jane Doe — Product Manager` manually on demand, not automatic after every profile edit.

## Recommended product decision

- Proposal: **autosave drafts + visible Save to library / Finalize button**.
- Proposal: **do not auto-promote every draft to saved**.
- Proposal Library/Documents: **make Draft vs Saved impossible to miss**.
- CV Forge: **keep current autosave model; no Draft/Saved split**.
- CV Forge: **add visible Rename**, not a Save button.

## Approved implementation direction from user

Add the proposal lifecycle button back in the Proposal rail:

- placement: directly under **New proposal** in the rail proposal Draft actions group;
- label: **Save to library**;
- icon: Phosphor **FloppyDisk** icon from `my-app/src/lib/icons.tsx` (`floppy-disk-back` requested; active compatibility export found is `FloppyDisk` backed by `@phosphor-icons/react`);
- visual treatment: same tokenized button style as the existing rail action buttons (`Button`, `variant="ghost"`, `size="sm"`, `iconLeft=...`), unless current UI review shows primary treatment is needed;
- disabled state: disabled when there is no proposal content, same as existing save behavior;
- behavior: call the existing `ProposalForge.tsx::handleSaveOutputToLibrary` path; do not create a new persistence path.

### Files to modify for this approved change

- `my-app/src/components/proposal/ProposalRail.tsx`
  - import `FloppyDisk` from `../../lib/icons`;
  - add optional prop `onSaveToLibrary?: () => void`;
  - render a `Save to library` button in the existing `Draft actions` group after `New proposal` and before `Delete proposal`;
  - guard rendering on `onSaveToLibrary` being provided;
  - use `disabled={!hasProposalContent}`.

- `my-app/src/pages/ProposalForge.tsx`
  - pass `onSaveToLibrary={handleSaveOutputToLibrary}` to `ProposalRail`;
  - keep the existing stage-bar save path intact unless duplicate UI becomes visually noisy after review.

- `my-app/src/components/proposal/__tests__/ProposalRail.style.test.tsx`
  - extend the existing “new and delete proposal actions” test to include `Save to library`;
  - assert it uses the same ghost token button class;
  - assert it calls `onSaveToLibrary` once;
  - add/extend disabled-state coverage when `hasProposalContent={false}`.

- Existing proposal save tests to keep green:
  - `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
  - `my-app/src/pages/__tests__/ProposalForge.autosave.test.tsx`

### Out of scope for this approved change

- Do not auto-promote drafts to saved.
- Do not add CV draft/saved status.
- Do not change CV autosave.
- Do not implement CV rename in this exact patch unless separately approved; keep it as a follow-up from the audit.

## Proposed next audit execution

1. Run focused tests for proposal draft/save/library and CV title policy.
2. Use a headless rendered check for `/documents`, `/proposal`, `/proposals`, `/cv`, and `/cvs` to verify visible labels/actions.
3. Produce a final audit in `docs/audits/` with severity-ranked issues.
4. If approved, implement a small follow-up:
   - clarify Documents/Proposal Library copy and draft chips;
   - restore/rename the visible proposal lifecycle action as `Save to library` or `Finalize` if missing;
   - keep proposal autosave language separate from save/finalize language;
   - add a CV rename action in CV Library and/or CV Forge title bar;
   - optionally add a manual “Update title from profile” action for CVs, without breaking manual title preservation.
