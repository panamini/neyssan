# Proposal Forge sidebar controls plan

## Context
The Proposal Forge sidebar currently mixes visible rail controls with a hidden legacy compose form. The live audit found these boundaries:

- **Active CV**: `ProposalRail` receives `sourceCvTitle`, `sourceCvMeta`, and `cvOptions`, so the rail can show and change the active source CV. `ProposalDisplay`'s header-details drawer has no source-CV props/section, so the document drawer cannot currently show active CV state.
- **Recipient details**: recipient details are auto-derived from the job offer path in `ProposalForge.tsx`: `proposalHeaderSourceSummary` via `buildProposalSourceSummary(...)`, then `autoProposalRecipientDetails` via `buildProposalRecipientPrefill(...)`. User edits are preserved because the auto-fill only replaces empty/current-auto values.
- **Draft setup**: `ProposalRail.tsx` renders `<details className="dasti-proposal-skeleton-rail__draft-setup">` without `open`, so it is collapsed by default.
- **AI stream**: `ProposalAIStream` is already rendered immediately under Source CV in `ProposalRail`, but it is always mounted and shows "Ready for edits" after loading. It is not tied to import/handoff completion.
- **Length / Style**: the Settings section is read-only. `Length` is `activeCharacterLimitSelection.label` from `resolveProposalCharacterLimitSelection(...)`. `Style` is `proposalStyleStatusLabel` (`CV`, `Custom`, or `Default`).
- **Tone selector**: the visible rail only shows `ToneBadge`. The working tone menu exists in `ProposalInputForm`, but that component is mounted inside `.dasti-proposal-hidden-implementation` with `hidden` / `aria-hidden`, so users cannot access it.

## Approach
Keep the current Proposal Forge rail as the single visible sidebar surface and move the missing controls/status into it instead of reviving the hidden compose UI. The rail should become the source of truth for: selected CV, draft setup, generation stream, tone selection, and status readouts.

## Files to modify
- `my-app/src/pages/ProposalForge.tsx`
  - Pass the required callbacks/state into `ProposalRail`.
  - Decide when the AI stream should be visible.
  - Wire tone selection to existing compose draft state (`composeToolbarVoicePreset`) and persisted form behavior.
- `my-app/src/components/proposal/ProposalRail.tsx`
  - Expand Draft setup by default.
  - Add active/source CV display affordance if the menu alone is not clear enough.
  - Replace the read-only tone badge with an accessible selector/menu.
  - Keep Length / Style as read-only unless we deliberately add controls in a later step.
- `my-app/src/components/proposal/ProposalAIStream.tsx`
  - Optionally adjust empty/done rendering if the rail controls visibility at the component level.
- Tests likely in:
  - `my-app/src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx`
  - `my-app/src/components/proposal/__tests__/ProposalDocumentStage.test.tsx` only if stage behavior changes.

## Reuse
- `ProposalRail` (`my-app/src/components/proposal/ProposalRail.tsx`) for the visible sidebar surface.
- `ProposalAIStream` (`my-app/src/components/proposal/ProposalAIStream.tsx`) for generation progress UI.
- `buildProposalSourceSummary` (`my-app/src/lib/proposal-source-summary.ts`) for recipient/company extraction from job text.
- `buildProposalRecipientPrefill` and `buildProposalSalutation` (`my-app/src/lib/proposal-header.ts`) for recipient fields.
- `resolveProposalCharacterLimitSelection` (`convex/lib/proposals/generationControls`) for the current Length readout.
- `getVoicePresetDisplayLabel`, `ToneBadge`, and existing tone menu option patterns in `ProposalInputForm.tsx` for a visible rail tone selector.

## Steps
- [ ] Add explicit active/source CV presentation in `ProposalRail` so the selected CV reads as active, not just as a menu label.
- [ ] Keep Source CV menu behavior intact (`cvOptions`, `onSelectCv`, `onClearCv`, `onCreateCv`, `onImportCv`).
- [ ] Change Draft setup from collapsed `<details>` to open-by-default. Prefer uncontrolled `<details open>` unless tests reveal a need for controlled state.
- [ ] Gate `ProposalAIStream` visibility from `ProposalForge`: show while handoff/import/generation has meaningful progress, hide after completion when there is no error/status needing attention.
- [ ] Add a visible Tone selector to `ProposalRail`, reusing the existing tone options/labels and wiring selection through `handleToolbarVoicePresetChange` / `composeToolbarVoicePreset`.
- [ ] Leave Length and Style as read-only status labels for this pass; rename/tooltip them if needed to make that clear.
- [ ] Add tests covering Draft setup default-open, active CV display, visible tone selector, and AI stream hidden-after-done behavior.

## Verification
- Run focused tests first:
  - `pnpm test --run src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx`
- Then run any touched component tests.
- Browser-check `/proposal` manually or via Playwright:
  - selected CV appears active under Source CV
  - Draft setup is expanded on first render
  - AI stream appears during generation/handoff and disappears when done
  - Tone can be selected from the visible rail
  - Recipient details still auto-populate from imported job/company details and preserve manual edits

## Out of scope for this pass
- Turning Length and Style into full editors/selectors unless explicitly requested after this cleanup.
- Changing the core proposal-generation request shape.
- Reworking `ProposalDisplay`'s document header drawer unless the user specifically wants Source CV duplicated inside the document editor drawer too.
