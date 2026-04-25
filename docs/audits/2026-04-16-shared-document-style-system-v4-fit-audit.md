# Shared Document Style System v4 Fit Audit

Date: 2026-04-16

## Verdict

The redesign mostly fits the active `my-app` architecture if it stays document-first and does not replace the current `verbati` render path.

The live repo already supports:

- `metadata.verbatiStyle` as persisted document render input
- canonical read/write normalization for document style
- proposal template/style twin mapping
- preview/export/print parity through shared document render models

The redesign does **not** fit as written if it tries to introduce, in MVP:

- a new preset-library backend
- persisted provenance/version schema changes everywhere at once
- a second workspace token authority beside the current `verbati` path
- a broad commit-boundary rewrite across all CV/style surfaces

## Classification

### Active code

- `my-app/src/features/verbati/style.ts`
- `my-app/src/lib/proposal-render-state.ts`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/pages/SettingsPage.tsx`
- `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx`
- `my-app/src/features/verbati/useBoundVerbatiCvStyle.ts`
- `my-app/src/App.tsx` routes `/cv`, `/proposal`, `/style`, `/settings`

### Legacy but informative code

- `my-app/src/pages/ProposalForgeNext.tsx`
  Route is redirected back to `/proposal`, so it is not authoritative, but it still documents prior proposal workspace assumptions.

### Obsolete/dead by project rule

- `pdf-ingest/`
- spaCy/training-oriented parser code
- `*.bak`
- backup/archive trees

## What Fits Now

- Keep `metadata.verbatiStyle` as the only document-style render authority.
- Keep the current `verbati` canonicalization path instead of adding a second token system.
- Keep proposal geometry separate from document appearance:
  - `templateId` for proposal structure
  - `verbatiStyle` for appearance
- Keep app-shell theming separate from document styling.

## What Must Change To Fit Cleanly

- Provenance and diff need to start as shared pure helpers first, not as a full persistence migration.
- The current repo lacks `custom_no_preset`, typed visual diffs, and a shared resolved style-state bundle for UI surfaces.
- Proposal attach/detach state is currently implicit in page state. It should be surfaced explicitly before any schema rewrite.

## What Should Be Deferred For MVP

- Replace the 3-slot settings model with a named preset library.
  Active repo still depends on `proposalSettings.getPresets` and `proposalPreset1..3`.
- Persist `metadata.visualStyleProvenance` and `metadata.styleCanonicalVersion`.
  This requires wider Convex/schema/read-back migration work than the first slice.
- Enforce the full workspace-vs-persisted commit contract.
  Current active CV/style surfaces still debounce local preview edits straight into `metadata.verbatiStyle`.
- Accessibility fallback/blocking rules in export.
  Useful, but not yet wired as a shared validator in the current document pipeline.

## First Slice Implemented

- Added a shared pure helper at `my-app/src/features/verbati/styleState.ts` for:
  - canonical style resolution
  - typed style diff derivation
  - explicit provenance states
  - `custom_no_preset`
- Wired `ProposalForge` to resolve and surface style-state status in the compose toolbar:
  - `Using CV style`
  - `Detached style`
  - `Custom style`
- Kept persisted render output unchanged:
  - `metadata.verbatiStyle` remains the saved render input
  - no second persisted style authority was added

## Important Current Gap

- Attaching a CV after `ProposalForge` is already open still leaves the workspace in a detached/local style state unless an inherited mode was already active.
- The first slice surfaces that reality instead of rewriting the whole attach lifecycle.
- A later slice should decide whether post-mount CV attach must auto-enter `cv_inherited` when no explicit local style ownership exists.

## Verification

- `rtk npm test -- src/features/verbati/__tests__/styleState.test.ts`
- `rtk npm test -- src/components/__tests__/ProposalComposeToolbar.test.tsx src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx`
