# ProposalForge job-context pipeline audit

## Context
Verify why ProposalForge can render an old job title in the job-context rail while the linked source page belongs to a different job, and confirm when the "Open job page" button is expected to be missing.

## Approach
- Audit the live `/proposal` route (`src/pages/ProposalForge.tsx`) and the active rail component (`src/components/proposal/ProposalRail.tsx`).
- Trace every source of job title, company, location, source URL, source label, job href, and match tag.
- Confirm which values are persisted when creating/updating proposals.
- Compare with existing vitest coverage for draft/saved/public-handoff hydration.

## Files to inspect
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/proposal/ProposalRail.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/pages/DashboardPage.tsx`
- `my-app/src/pages/DocumentsPage.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/components/onboarding/QuickStartFlow.tsx`
- `my-app/src/lib/proposal-workspace-state.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/proposal-style-trace.ts`
- `my-app/src/lib/proposal-source-summary.ts`
- `my-app/src/lib/proposal-source-platforms.ts`
- `my-app/convex/createProposalPublic.ts`
- `my-app/convex/updateProposalPublic.ts`
- Relevant tests in `my-app/src/pages/__tests__/ProposalForge.*.test.tsx`, `my-app/src/components/proposal/__tests__/ProposalRail.*.test.tsx`, and `my-app/src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`

## Reuse
- `readStoredProposalComposeDraft` / `writeStoredProposalComposeDraft` in `src/lib/proposal-workspace-state.ts`
- `readStoredProposalOutputDraft` / `writeStoredOutputDraft` in `src/lib/proposal-output-draft.ts`
- `buildProposalSourceSummary` in `src/lib/proposal-source-summary.ts`
- `getProposalSourceLabel` in `src/lib/proposal-source-platforms.ts`
- Existing hydration tests:
  - `ProposalForge.draft-persistence.test.tsx`
  - `ProposalForge.saved-view.test.tsx`
  - `ProposalForge.job-id-brief.test.tsx`
  - `ProposalForge.public-handoff-hydration.test.tsx`

## Confirmed findings
- Active route is `/proposal -> ProposalForge`, not `ProposalForgeNext`.
- Job-context precedence in the live code path is split by field:
  - rail title: `canonicalJobRecord.title -> prefill.jobTitle -> storedComposeDraft.jobTitle -> composePreviewValues.jobTitle`
  - rail description: `canonicalJobRecord.rawDescription -> composePreviewValues.jobDescription -> prefill.jobDescription -> storedComposeDraft.jobDescription`
  - rail source URL/platform: `canonicalJobRecord -> outputSourceComposeDraft -> composePreviewValues -> composeDraftInitialSeed -> storedOutputDraft.sourceComposeDraft -> storedComposeDraft -> stickyImportedSource -> prefill`
  - rail company/location: `canonicalJobRecord.company -> proposalHeaderSourceSummary.company` and `proposalHeaderSourceSummary.location`; that summary is derived from `proposalHeaderSourceJobTitle` / `proposalHeaderSourceDescription` (`canonicalJobRecord.title -> composePreviewValues.jobTitle -> outputSourceComposeDraft.jobTitle -> composeDraftInitialSeed.jobTitle -> storedOutputDraft.sourceComposeDraft.jobTitle -> prefill.jobTitle`, with the same pattern for description), so stale title/description can also bleed into company/location.
  - job page href: only `canonicalJobId` from the URL query string
  - match tag: only `canonicalJobRecord.matchRead/matchReview`
- The stale/wrong-title bug is plausible because the rail title and source URL do not share one source-of-truth. `briefJobTitle` never looks at `outputSourceComposeDraft`/`composeDraftInitialSeed`/`storedOutputDraft.sourceComposeDraft`, while `briefSourceUrl` can prefer those later compose/output-draft values; that means a stale `canonicalJobId`/`canonicalJobRecord` can keep an old title visible while a newer compose/source draft points at a different job page, and the same split applies when no canonical record is present but stored draft state remains.
- `selectedDraftProposalId` is a concrete hydration path: opening a draft row seeds `outputSourceComposeDraft`/`composePreviewValues` from that row’s metadata, and that path falls back from `metadata.sourceJobTitle` to `draftProposal.title` when source title metadata is missing.
- `handleCopySavedProposalToDraft` is the other historical hydration path: duplicating a saved proposal back into compose uses `metadata.sourceJobTitle` when present, otherwise falls back to `savedProposalDocumentTitle` / `openedSavedProposal.title`, which can intentionally or accidentally preserve an old/non-source title.
- `duplicateSourceJobId` only feeds persisted `jobId`; it does not participate in rail title/source-label rendering.
- `proposalWorkspaceResetToken` is the explicit reset boundary used by some entry flows, but not all `/proposal` navigations set it. `DocumentsPage` and `QuickStartFlow` clear first, while `Sidebar` can explicitly rehydrate stored drafts via `refreshProposalWorkspaceDraftState` before navigating and `DashboardPage` can navigate to `/proposal` without a reset token, so stale compose state can be revived or preserved if the workspace wasn’t explicitly cleared first.
- The "Job page" button is compose-rail-only; it does not render in saved-view layouts because `ProposalRail` is not mounted there. In compose view it is also hidden until the job-context drawer is expanded (`jobContextOpen` defaults to closed). Even in compose view, a current `?jobId=` route / `canonicalJobId` is required to show the button.
- The job-links group appears when `jobHref || sourceUrl` and the drawer is open; the Source button itself depends on `sourceUrl`.
- `ProposalInputForm` resolves source metadata from `liveSourceUrl -> initialComposeDraft -> prefill -> stored draft`, then `stickyImportedSource` keeps the last non-null source values alive after the live inputs go empty; `getProposalSourceLabel` normalizes the visible label.
- `buildStoredProposalComposeDraftSnapshot` preserves `sourceUrl`/`platform` from existing compose/output drafts and sticky imported source state, so stale source metadata can be carried forward even after the visible job title changes.
- Current create/update paths persist source metadata from `proposalPersistenceMetadata`; `sourceJobTitle`, `sourceJobDescription`, `sourceUrl`, `platform`, and `jobId` are all part of that persisted metadata when present.

## Likely implementation direction
- Introduce a single resolved source-job context helper for ProposalForge/ProposalInputForm so title, company, location, source URL, platform, and job id are chosen from one coherent winner instead of separate per-field chains.
- Prefer the live canonical job record when its identity matches the current route/source context; otherwise fall back to the incoming compose/source draft bundle as a unit.
- On route/job switches, explicitly clear or reseed stale compose state before rendering the next job context, rather than letting old draft state survive silently.
- Keep saved-view duplication behavior intact, but make its fallback title/source rules explicit so missing `sourceJobTitle` cannot silently mask a mismatched source.

## Steps
- [x] Verify exact precedence order in the live code path and document it precisely.
- [x] Confirm which stored state can outlive a job switch and keep an old title visible.
- [x] Confirm what metadata is written on proposal create/update for future proposals.
- [x] Confirm which metadata is required for the source link vs. job-page button.
- [x] Check current tests for gaps around stale title and historical saved proposals.
- [ ] Add/adjust regression tests around:
  - stale compose draft state being ignored when a new canonical job loads
  - stale canonical job data / `jobId` not winning over a newer source URL from compose/output draft state
  - `selectedDraftProposalId` hydration not leaking an old row title into a different job’s context
  - `handleCopySavedProposalToDraft` falling back from missing `sourceJobTitle` without smearing an unrelated old title into the new compose draft
  - `Sidebar` rehydrating stored drafts only when intended, and dashboard entry into `/proposal` not silently preserving stale compose state when the workspace should be fresh
  - saved-view proposals not rendering the compose-rail job-page button
  - `ProposalInputForm` source metadata / imported-source label behavior when URL, platform, and draft state diverge (use the existing provider-busy coverage as the primary target)
  - `ProposalRail` showing/hiding the source link and job page link with the exact current conditions
  - persistence of `sourceJobTitle`, `sourceUrl`, `platform`, and `jobId` on newly created proposals from job offers
  - `duplicateSourceJobId` only affecting saved metadata, not rail display

## Verification
- Read-only code inspection only.
- Inspected `ProposalForge.job-id-brief.test.tsx`, `ProposalForge.saved-view.test.tsx`, `ProposalForge.brief-card.test.tsx`, `ProposalRail.style.test.tsx`, and `ProposalInputForm.provider-busy.test.tsx` for current coverage shape.
- Narrow vitest coverage ran for `ProposalForge.job-id-brief.test.tsx`, `ProposalForge.saved-view.test.tsx`, and `ProposalForge.brief-card.test.tsx`.
- `job-id-brief` and `saved-view` passed; `brief-card` failed because that test's mocked generate button no longer matches the current UI, which is orthogonal to the job-context audit.
