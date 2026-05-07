# Proposal Saved Open / Save Snapshot / Empty Job Context Plan

Date: 2026-05-07
Scope: Proposal Forge + Documents/Proposal library routing only. Do not change CV Forge autosave/draft behavior in this pass.

## Goal

Fix three Proposal Forge UX problems:

1. Clicking a saved proposal document should open that document inside Proposal Forge, not the legacy saved proposal list.
2. Clicking **Save to library** must not make the current proposal disappear or reset the workspace back to “Generate proposal.”
3. When no job is loaded in Proposal rail job context, show a useful empty job context surface: open Job Forge, paste a job offer, and discrete clickable job-site tokens.

## Assumptions

- CV Forge behavior is acceptable as-is: always autosaved, no draft/saved split.
- Proposal drafts remain autosaved.
- The current `/proposal?view=saved&id=...` route is valid, but its rendered UI is wrong because it mounts `ProposalsList` as the main saved-view surface.
- The user now prefers save behavior that keeps the current working draft/window visible while placing a saved document in the library.

## Product decisions for this pass

### Saved proposal opening

Saved documents should open as a single document in Proposal Forge.

- Good: `/proposal?view=saved&id=<proposalId>` opens the selected proposal in a forge-like document view.
- Bad/current: saved route opens the legacy full saved proposal list.

The saved library/list can still exist at `/proposals` or `/documents`, but it should not appear after clicking a specific saved document.

### Save to library behavior

Change the mental model from “save clears/promotes then resets workspace” to:

> Save to library creates/updates a saved library snapshot, then keeps the current document visible.

Preferred behavior:

- User clicks **Save to library**.
- Dialog confirms title.
- A saved row is written to library with `status: "saved"`.
- The current proposal content remains on screen.
- The current workspace does **not** reset to empty/generate state.
- Show success toast: “Saved to library.”
- If the current active row is still a draft, keep it as the active draft so continued edits remain draft work.

Important: do not auto-promote every draft to saved just because autosave ran.

Implementation nuance:

- The cleanest user behavior is “save snapshot to library, keep draft open.”
- To avoid duplicate spam, keep a per-session saved snapshot id/ref after first Save to library and update that saved row on subsequent saves from the same draft/session.
- If no saved snapshot id is known, create a new saved row.
- Do not set `generatedProposalId` to the saved snapshot id if the user should remain on the draft.
- If current proposal was opened from an existing saved document, edits should update that saved document only after explicit saved-edit commit, not silently become a new draft unless user chooses Duplicate to draft.

### Empty job context behavior

When no real job context is loaded:

- Show a button: **Open Job Forge** / **Open jobs** (route to `/jobs`).
- Show a square-ish textarea in the Job context drawer with placeholder: `Paste your job offer here`.
- Show discrete small token-style clickable site labels:
  - Hellowork
  - ZipRecruiter
  - LinkedIn
  - Indeed
  - Upwork

Click behavior for site tokens:

- If a known URL exists, open the external site in a new tab.
- Keep token styling small/discreet.
- Do not pretend the app can scrape those sites from the token alone unless that flow already exists.

## Files likely to modify

### Saved open / route behavior

- `my-app/src/pages/ProposalForge.tsx`
  - Replace `isSavedView ? <ProposalsList ... /> : ...` behavior for a selected saved id.
  - Render the selected saved proposal as a single Proposal Forge document view.
  - Reuse existing `openedSavedProposal`, `savedProposalContent`, `savedProposalDocumentTitle`, `savedProposalOutputMode`, saved heading/style state, and existing saved document commit/export handlers.
  - Keep `ProposalsList` out of the selected-document route.

- `my-app/src/components/ProposalsList.tsx`
  - Keep list behavior for `/proposals` if needed.
  - Ensure item click for saved documents routes to `/proposal?view=saved&id=<id>`.
  - Ensure draft click routes to `/proposal?draftId=<id>`.

- `my-app/src/pages/DocumentsPage.tsx`
  - Confirm saved proposal cards route to `/proposal?view=saved&id=<id>`.
  - Confirm draft cards route to `/proposal?draftId=<id>`.

- `my-app/src/components/Sidebar.tsx`
  - Confirm saved proposal recent links open `/proposal?view=saved&id=<id>` and not a saved-list route.

### Save to library non-reset behavior

- `my-app/src/pages/ProposalForge.tsx`
  - Change `handleSaveOutputToLibrary` so it does not clear `proposalContent`, `proposalType`, `proposalVoicePreset`, `proposalDocumentTitle`, local output draft, compose draft, or route params after save.
  - Add/save a `lastSavedLibrarySnapshotIdRef` or equivalent session ref if using save-snapshot semantics.
  - Write saved row through existing `createProposalPublic` / `updateProposalPublic` validators.
  - Keep existing autosave draft path intact.
  - Update toast text to confirm saved without implying workspace reset.

- `my-app/src/components/proposal/ProposalRail.tsx`
  - Existing Save to library button remains under New proposal.
  - Keep FloppyDisk icon and ghost token style.

### Empty job context surface

- `my-app/src/components/proposal/ProposalRail.tsx`
  - Add props for empty-job-context paste field and actions:
    - `jobDescriptionDraft?: string`
    - `onJobDescriptionDraftChange?: (value: string) => void`
    - `onJobDescriptionDraftCommit?: () => void`
    - `onOpenJobs?: () => void`
  - In Job context drawer, if no `jobTitle`, no `jobHref`, no `sourceUrl`, and no summary, render empty context UI:
    - Open Job Forge button
    - square textarea placeholder `Paste your job offer here`
    - site tokens

- `my-app/src/pages/ProposalForge.tsx`
  - Wire empty job textarea to compose draft state.
  - Persist pasted job offer to `dasti:proposal-compose-draft:v1` through existing compose draft helpers.
  - Ensure generation uses pasted text. This may require updating `composeDraftInitialSeed` and remounting/syncing the hidden `ProposalInputForm` carefully.

- `my-app/src/styles/product-proposal.css`
  - Add token-only styles for empty job context textarea and job-site tokens if existing token classes are insufficient.

## Implementation sequence

### Phase 1 — Tests / behavior locks first

Add or update focused tests before implementation:

1. Saved proposal route:
   - Render `/proposal?view=saved&id=saved_1`.
   - Assert it shows the selected proposal document content/title.
   - Assert it does **not** render the legacy saved proposal list as the main surface.

2. Save to library no reset:
   - Start with generated proposal content.
   - Click rail **Save to library**.
   - Confirm dialog title.
   - Assert create/update saved row called with `status: "saved"`.
   - Assert proposal content remains visible after save.
   - Assert workspace does not reset to empty/generate-only state.
   - Assert local draft is not cleared if we keep draft-open snapshot semantics.

3. Empty job context:
   - Render ProposalRail with no job context.
   - Open Job context drawer.
   - Assert Open Job Forge button exists.
   - Assert textarea placeholder `Paste your job offer here` exists.
   - Assert Hellowork, ZipRecruiter, LinkedIn, Indeed, Upwork tokens exist and are clickable links/buttons.

### Phase 2 — Saved document opens inside Proposal Forge

- In `ProposalForge.tsx`, split saved mode into:
  - selected saved document route: render single saved document forge surface;
  - no selected id: optionally route back to `/documents?tab=proposals` or render a lightweight empty state, not the legacy list.
- Reuse existing saved proposal state and `ProposalDocumentStage` where possible.
- Keep export/duplicate actions available.

### Phase 3 — Save to library keeps current window

- Change `handleSaveOutputToLibrary` cleanup behavior.
- Stop clearing local output/compose draft after save.
- Stop setting `proposalContent(null)` and other blank state after save.
- Stop navigating away/resetting params after save.
- Write saved snapshot and keep the current draft visible.
- Use a session ref to update the same saved snapshot on repeated saves where possible.

### Phase 4 — Empty job context paste surface

- Add ProposalRail props and UI.
- Wire textarea to compose draft state in ProposalForge.
- Add token styling/link behavior.
- Ensure pasted text becomes usable by Generate.

### Phase 5 — Verification

Run focused checks:

```bash
rtk pnpm --dir my-app exec vitest --run \
  src/pages/__tests__/ProposalForge.saved-view.test.tsx \
  src/pages/__tests__/ProposalForge.save-to-library.test.tsx \
  src/components/proposal/__tests__/ProposalRail.style.test.tsx
```

Then run TypeScript:

```bash
rtk pnpm --dir my-app exec tsc --noEmit
```

Optional broader checks if time allows:

```bash
rtk pnpm --dir my-app exec vitest --run \
  src/pages/__tests__/DocumentsPage.test.tsx \
  src/components/__tests__/Sidebar.proposal-navigation.test.tsx \
  src/components/__tests__/ProposalsList.route-selection.test.tsx
```

## Non-goals

- Do not change CV Forge autosave behavior.
- Do not add CV draft/saved status.
- Do not build a new scraper/import system for the job-site tokens.
- Do not delete the legacy list component in this pass; just stop showing it when a specific saved proposal is opened.
- Do not broaden proposal persistence validators unless absolutely required.

## Open questions before implementation

1. Save semantics final choice:
   - A. Save snapshot copy to library and keep draft open.
   - B. Promote draft row to saved but keep it visible and treat further edits as saved edits.

   The user wording points to A, but A needs duplicate-control logic.

2. Empty job context textarea generation wiring:
   - Need confirm whether updating `composeDraftInitialSeed` is enough for the hidden `ProposalInputForm`, or whether a small explicit bridge prop/API is needed.

3. Saved document forge surface:
   - Reuse the full rail or show a simpler saved-document rail? Smallest pass should reuse existing stage/actions and avoid rebuilding the whole rail.
