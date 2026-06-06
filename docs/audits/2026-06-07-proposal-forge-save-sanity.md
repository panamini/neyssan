# Proposal Forge Save Sanity Audit

Date: 2026-06-07
Branch: `codex/proposal-save-sanity-docs`
Scope: active `v1` Proposal Forge generated-output save, local draft, and library persistence path.

## User Requirement

The Proposal Forge save path should follow one clear standard:

1. generated proposal content stays open after save.
2. explicit save writes the current proposal to the proposal library as `saved`.
3. the local output draft keeps the current proposal id, title, content, document, and output mode.
4. autosave can continue after explicit save.
5. reopening Proposal Forge should not silently replace the current output with another proposal.

## Active Code Path

| Area | Active files / functions | Status |
| --- | --- | --- |
| Proposal route page | `my-app/src/pages/ProposalForge.tsx` | active code |
| Generated document stage | `my-app/src/components/proposal/ProposalDocumentStage.tsx` | active code |
| Save title dialog | `my-app/src/components/ProposalSaveDialog.tsx` | active code |
| Local output draft cache | `my-app/src/lib/proposal-output-draft.ts` | active code |
| Workspace local state | `my-app/src/lib/proposal-workspace-state.ts` | active code |
| Proposal persistence mutation | `upsertProposalDocument` through `flushScheduledProposalSave(...)` | active code |

Older saved-list and drawer tests are informative, but several are currently stale against the active topbar/drawer shell.

## Confirmed Regression

The generated proposal toolbar had no active save-to-library entry point.

`ProposalDocumentStage` only renders the save button when `onSaveToLibrary` is passed. `ProposalForge` imported the active stage but did not pass that callback, so the button labeled `Save proposal to library` was missing from the generated-output screen.

The existing focused test reproduced this before the fix:

```text
rtk npx vitest run src/pages/__tests__/ProposalForge.save-to-library.test.tsx
```

Result before the patch: all three tests failed because the save button could not be found.

## Fix Applied

`my-app/src/pages/ProposalForge.tsx` now wires the active save flow:

- renders `ProposalSaveDialog`.
- passes `onSaveToLibrary` to `ProposalDocumentStage`.
- opens the dialog only when generated proposal content exists and persistence is available.
- calls `flushScheduledProposalSave(title, { status: "saved" })` on confirm.
- marks the current proposal library status as `saved`.
- updates the current generated proposal id if the persistence layer returns one.
- updates the local output draft with the saved title, current content, document payload, proposal id, and output mode.
- keeps the generated proposal open after save and shows `Saved to library.`
- passes `onDeleteDraft` to the stage so the existing trash action is wired on the same active toolbar.

`my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx` was updated to match the current active UI contract: after save, the generated document stage remains open instead of expecting a legacy in-page proposal rail route.

## Step-By-Step Save Pipeline

### Generated Proposal, Explicit Save

1. The generated proposal stage receives `onSaveToLibrary`.
2. The toolbar button opens `ProposalSaveDialog`.
3. The confirmed title is normalized from the dialog value, current document title, or `Untitled proposal`.
4. `flushScheduledProposalSave(...)` writes the current proposal snapshot with `status: "saved"`.
5. `generatedProposalId` and `generatedProposalIdRef` are updated if a persisted id is returned.
6. The local output draft is rewritten with the same saved title, content, document model, output mode, and proposal id.
7. The dialog closes and the current proposal remains visible.

### Generated Proposal, Autosave After Save

1. The explicit save sets `proposalLibraryStatus` to `saved`.
2. The current id remains attached to the open output draft.
3. Later edits continue using the same active document identity instead of creating an unrelated local output.

### Refresh / Reopen Boundary

Proposal Forge uses the output draft and workspace state as the local continuity layer. The explicit save path now keeps those layers aligned with the persisted proposal id and title, so a refresh should restore the proposal the user was working on rather than selecting another proposal from the library by accident.

## Verification

Focused verification passed after the fix:

```text
rtk npx vitest run src/pages/__tests__/ProposalForge.save-to-library.test.tsx
rtk npx tsc --noEmit
```

Additional adjacent checks were run for the lower-level draft and workspace helpers:

```text
rtk npx vitest run src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx src/lib/__tests__/proposal-output-draft.test.ts src/lib/__tests__/proposal-workspace-state.test.ts
```

Result: the focused save-to-library suite, output draft guard, output draft library tests, workspace state tests, and TypeScript check passed.

Read-only Fallow advisory was also run against `main`. It still reports a branch-level advisory fail from inherited and broader branch findings, but after refactoring the save callback it no longer reports an introduced Proposal Forge complexity finding for this save-to-library fix.

## Known Boundary

Several broad Proposal Forge component tests still fail for stale harness reasons unrelated to this save-button regression:

- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx` expects legacy saved-list rendering and in-page duplicate controls for selected saved routes.
- `my-app/src/pages/__tests__/ProposalForge.generated-style-sync.test.tsx` still looks for an old visible `Generate proposal` button.
- `my-app/src/pages/__tests__/ProposalForge.draft-persistence.test.tsx` expects older drawer/topbar placeholders and controls.

Those failures were not hidden. They should be modernized separately around the current topbar/drawer architecture before treating the entire Proposal Forge component suite as authoritative.

## Practical Standard Going Forward

Proposal Forge should treat generated proposal persistence as one pipeline:

1. keep generated content in the document stage.
2. save the exact current snapshot through the persistence mutation.
3. write `status: "saved"` only on explicit library save.
4. keep the local output draft aligned with the persisted id and title.
5. keep autosave operating on the current proposal after explicit save.
6. avoid route or library selection side effects that replace the open proposal unless the user explicitly opens a different saved proposal.

If a future change updates only the remote proposal row or only the local output draft, Proposal Forge can regress into the same class of "saved but not the current thing" bug that CV Forge had.
