# Proposal Workspace Persistence Recovery Plan

Date: 2026-03-31

## Goal

Keep the restored `ProposalForge` runtime stable, keep Proposal/Resume state boundaries clean, and only continue UI migration after persistence remains green.

## Current Status

- `/proposal` routes to `ProposalForge`
- `/proposal-next` is not the active runtime path
- Proposal -> Resume -> Proposal manual retest is green
- Proposal attach/remove CV now uses a Proposal-owned state boundary
- output draft persistence no longer:
  - disappears on initial mount
  - overwrites a valid generated draft with metadata-only null-content state

## Checklist Status

### Green

- generate -> resume -> proposal persistence
- proposal-attached CV survives resume detours
- output draft survives resume detours
- compose draft survives resume detours
- saved proposal -> back to draft remains coherent
- save button above output does not clear live draft

### Still required before broader migration

- keep real-browser regression coverage stable in an environment where Chromium launches reliably
- add a short follow-up cleanup/decision note once the next UI migration batch starts

## Immediate Acceptance Criteria

The following must remain true:

1. Proposal workspace entry points land on `/proposal`
2. Saved proposal entry points land on `/proposal?view=saved&id=...`
3. Proposal-attached CV remains independent from Resume `cvActiveId`
4. `dasti:proposal-compose-draft:v1` survives resume detours unless the user explicitly resets or deletes the workspace
5. `dasti:proposal-output-draft:v1` survives resume detours unless the user explicitly resets or deletes the workspace
6. valid generated output is never replaced in storage by metadata-only null-content state

## Protected Invariants

Do not break these again:

- Proposal attach must not call Resume `loadCv()`
- Proposal page must not depend on Resume `currentCv` for attached-CV styling behavior
- output draft persistence must not write transient generation-start/error states as if they were real output drafts
- runtime ownership stays with `ProposalForge` during the next migration steps

## Next Work: Resume UI Migration Safely

Now that persistence is green, the next work can resume, but with scope control.

### Allowed next steps

- backport safe presentational pieces from `ProposalForgeNext` into `ProposalForge`
- continue toolbar/chrome/layout polish only if it does not alter route/state ownership
- extract pure presentational components where that reduces page complexity without changing state semantics

### Not allowed in the next pass

- switching `/proposal` back to `ProposalForgeNext`
- reintroducing shared Proposal/Resume CV identity
- broad route/state rewrites while the restored runtime is working

## Recommended Migration Order

1. Keep `ProposalForge` as live runtime
2. Treat `ProposalForgeNext` as donor/reference only
3. Backport UI pieces one by one:
   - toolbar visuals
   - inspector/presentational panels
   - shell polish
4. Re-run the proposal persistence suite after each migration slice

## Regression Suite To Keep Running

### Vitest

- `src/lib/__tests__/proposal-personalization.test.ts`
- `src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
- `src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
- `src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx`
- `src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx`
- `src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
- `src/pages/__tests__/ProposalForge.saved-view.test.tsx`

### Browser

- `e2e/proposal-workspace-roundtrip.spec.ts`

## Definition Of Done For The Persistence Fix

Done means:

1. manual generate -> resume -> proposal keeps compose input and output
2. proposal-attached CV stays correct across the same roundtrip
3. saved proposal -> live draft remains coherent
4. the focused persistence suite stays green

## Definition Of Done For The Next UI Migration Phase

Done means:

1. the visual migration slice lands inside `ProposalForge`
2. the persistence suite still stays green after the slice
3. no route/runtime ownership changes are introduced
