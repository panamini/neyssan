# Proposal Forge Save Sanity Audit

Date: 2026-06-07
Branch: `codex/proposal-save-sanity-docs`
Scope: active `v1` Proposal Forge generated-output save, local draft, and library persistence path.

Follow-up update: after live review, the document toolbar should not expose manual `Save to library` or `Delete draft` controls. The visible product model is autosave plus project/library management from the library surfaces.

## User Requirement

The Proposal Forge save path should follow one clear standard:

1. generated proposal content stays open and autosaves.
2. the document toolbar stays focused on editing, heading, style, templates, and draft/source controls.
3. delete/archive behavior belongs to project/library surfaces, not the document-stage toolbar.
4. the local output draft keeps the current proposal id, title, content, document, and output mode.
5. reopening Proposal Forge should not silently replace the current output with another proposal.

## Active Code Path

| Area | Active files / functions | Status |
| --- | --- | --- |
| Proposal route page | `my-app/src/pages/ProposalForge.tsx` | active code |
| Generated document stage | `my-app/src/components/proposal/ProposalDocumentStage.tsx` | active code |
| Local output draft cache | `my-app/src/lib/proposal-output-draft.ts` | active code |
| Workspace local state | `my-app/src/lib/proposal-workspace-state.ts` | active code |
| Proposal persistence mutation | `upsertProposalDocument` through `flushScheduledProposalSave(...)` | active code |

Older saved-list and drawer tests are informative, but several are currently stale against the active topbar/drawer shell.

## Confirmed Regression And Follow-Up

The generated proposal toolbar had no active save-to-library entry point.

`ProposalDocumentStage` only renders the save button when `onSaveToLibrary` is passed. `ProposalForge` imported the active stage but did not pass that callback, so the button labeled `Save proposal to library` was missing from the generated-output screen.

The existing focused test reproduced this before the fix:

```text
rtk npx vitest run src/pages/__tests__/ProposalForge.save-to-library.test.tsx
```

Result before the first patch: all three tests failed because the save button could not be found.

Live review then clarified that this was the wrong visible product direction: Proposal Forge should rely on autosave and library/project management, not manual save/delete controls in the document toolbar.

## Fix Applied

`my-app/src/pages/ProposalForge.tsx` now leaves the active document toolbar without manual library actions:

- no `ProposalSaveDialog` is rendered from the generated document stage.
- `ProposalDocumentStage` no longer receives `onSaveToLibrary` from Proposal Forge.
- `ProposalDocumentStage` no longer receives `onDeleteDraft` from Proposal Forge.
- the generated proposal remains open under the autosave/local-output-draft continuity path.
- delete/archive expectations stay with project/library surfaces.

`my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx` now asserts that generated output opens without `Save proposal to library` / `Delete draft` document-toolbar buttons.

## Step-By-Step Save Pipeline

### Generated Proposal, Autosave

1. The generated proposal stage opens with the current local output draft or generated content.
2. Proposal Forge writes through the existing scheduled proposal save path.
3. The current id remains attached to the open output draft.
4. Later edits continue using the same active document identity instead of creating an unrelated local output.

### Refresh / Reopen Boundary

Proposal Forge uses the output draft and workspace state as the local continuity layer. Those layers should remain aligned with the persisted proposal id and title, so a refresh should restore the proposal the user was working on rather than selecting another proposal from the library by accident.

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

Follow-up verification for the toolbar removal:

```text
rtk npx vitest run src/lib/__tests__/chrome-extension-url-and-job.test.ts src/pages/__tests__/ProposalForge.save-to-library.test.tsx src/components/proposal/__tests__/ProposalDocumentStage.test.tsx
rtk npx tsc --noEmit
```

Headless Chrome Canary DOM verification also reached `/proposal?handoffId=...` and showed the document toolbar actions as Edit, Preview, Heading, Design, Templates, and Draft, without save/delete library buttons.

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
2. autosave the exact current snapshot through the persistence path.
3. keep manual delete/archive controls in project/library surfaces.
4. keep the local output draft aligned with the persisted id and title.
5. keep autosave operating on the current proposal after generation and edits.
6. avoid route or library selection side effects that replace the open proposal unless the user explicitly opens a different saved proposal.

If a future change updates only the remote proposal row or only the local output draft, Proposal Forge can regress into the same class of "saved but not the current thing" bug that CV Forge had.
