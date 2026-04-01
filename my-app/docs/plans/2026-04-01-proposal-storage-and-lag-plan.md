# Proposal Storage And Lag Plan

Date: 2026-04-01

## Why This Plan Exists

The proposal reopen bug is visually recovered, but the workspace still shows heavy lag in the browser. Current code and console evidence prove that proposal output persistence is hitting browser storage quota and falling back at runtime:

- `proposal-output-draft.ts` now logs `QuotaExceededError` on `localStorage.setItem(...)`
- `ProposalForge` still persists output state on the active workspace path
- `CvLibraryContext` still stores the CV index and per-document snapshots in `localStorage`

This means the current fix is a safety recovery, not the final commercial-grade storage design.

## Proven Findings

### Active Code

- Proposal output draft persistence uses synchronous browser storage
  - `my-app/src/lib/proposal-output-draft.ts`
- Proposal output persistence runs on the active `/proposal` workspace path
  - `my-app/src/pages/ProposalForge.tsx`
- The app now survives output-draft quota failure by falling back to `sessionStorage`
  - `my-app/src/lib/proposal-output-draft.ts`
- CV library state is still persisted into `localStorage`
  - `my-app/src/contexts/CvLibraryContext.tsx`

### Proven From Browser Logs

- `localStorage` quota is already exceeded for the proposal output key
- repeated synchronous storage failures were part of the lag path
- the stale compose draft in `localStorage` is no longer the main root cause by itself

### Not Yet Proven

- the exact percentage of lag caused by storage exceptions versus React re-render work
- whether the browser extension itself is adding measurable overhead on the same focus/message path
- the exact largest storage keys in the current real browser profile

## Product Position

For a commercial app:

- users should not be expected to manually clear browser storage
- `localStorage` should not be the main persistence layer for growing documents
- synchronous storage writes should not be on the critical interaction path
- the server or an async client database should own durable document-scale state

Manual storage clearing is acceptable only as a temporary developer workaround, not as a user-facing solution.

## Best-Practice Target Architecture

### Keep In `localStorage`

Only tiny, low-risk values:

- theme
- selected IDs
- last-opened workspace mode
- reset tokens
- very small compose preferences

Target: keep proposal-related `localStorage` usage in the low-KB range, not document-scale payloads.

### Move Out Of `localStorage`

Anything document-like or growing:

- generated proposal output drafts
- large compose snapshots
- CV library indexes if they grow materially
- full CV document caches and snapshots

### Preferred Durable Layers

1. Server for canonical persistence
2. IndexedDB for async browser-side caching/offline draft recovery
3. `sessionStorage` only as an emergency transient fallback
4. `localStorage` only for tiny synchronous hints and preferences

## Priority Order

### Priority 0: Commit The Current Recovery

Commit the current proposal reopen and quota-fallback fixes now.

Why:

- the visual reopen bug is fixed
- quota failure no longer breaks the visible restore path
- the current changes are coherent and tested
- broader storage work should happen in a new checkpoint, not mixed into this fix set

### Priority 1: Measure Real Storage Pressure

Add a small internal diagnostic utility for development:

- list every proposal- and CV-related browser storage key
- record approximate payload size per key
- record total `localStorage` footprint
- record when output draft switches to session fallback

Deliverable:

- one dev-only diagnostic helper or panel
- one audit file with measured storage usage from a real heavy browser profile

Reason:

- right now quota pressure is proven
- the biggest offenders are strongly suspected, but not yet measured in production-like browser state

### Priority 2: Remove Proposal Output Drafts From `localStorage`

Replace document-scale proposal output persistence with:

- IndexedDB for client-side draft cache
- server persistence as the durable source of truth when available

New intended behavior:

- `localStorage` stores only a tiny pointer or timestamp if needed
- proposal body, render metadata, and source compose snapshot live in IndexedDB or server-backed state
- `sessionStorage` fallback remains only as a temporary guardrail during migration

Reason:

- proposal output is already large enough to hit quota under real usage
- `localStorage` is synchronous and blocks the main thread

### Priority 3: Remove Heavy CV Cache Writes From `localStorage`

Audit and migrate these paths:

- CV library index persistence
- per-document local snapshot persistence
- any duplicated legacy keys

Probable target:

- keep a compact index in IndexedDB or server cache
- keep full CV document snapshots out of `localStorage`
- stop duplicating large payloads across multiple keys where not required

Reason:

- CV cache growth is a strong candidate for why quota pressure got worse over time
- even if Proposal Forge writes are optimized, storage pressure will return if the heavy CV cache remains in sync local storage

### Priority 4: Introduce A Single Storage Adapter For Proposal Workspace State

Create a small storage abstraction for proposal workspace persistence:

- `tinySyncStore`
  - `localStorage`
  - for tiny flags and IDs only
- `draftCache`
  - IndexedDB
  - for compose and output drafts
- `serverWorkspaceStore`
  - canonical persistence when authenticated

Rules:

- no direct document-scale `localStorage.setItem(...)` in proposal UI code
- storage writes must be routed through the adapter
- adapter must report fallback mode and quota events

Reason:

- today the logic is scattered
- commercial stability needs one authoritative storage contract

### Priority 5: Re-Profile UI Lag After Storage Migration

Only after storage pressure is removed:

- profile focus/open/typing on `/proposal`
- measure `ProposalForge` re-renders
- measure sidebar invalidation
- measure cost of `setLastProposalRequest(values)` and any other parent state churn

Then decide whether to:

- debounce parent updates
- reduce render breadth
- split proposal workspace state
- memoize expensive selectors or derived metadata

Reason:

- storage failures are already proven contributors
- React optimization before removing proven blocking storage work risks solving the wrong layer first

### Priority 6: UI Polish After Reliability And Performance

UI polish should come after:

- storage quota path is removed from the hot path
- proposal open/return feels stable
- typing and focus are responsive again

Reason:

- UI work on top of a laggy workspace is lower-value and harder to evaluate accurately

## Concrete Next Implementation Steps

1. Commit the current proposal recovery work.
2. Remove duplicate legacy CV cache writes.
3. Add a dev storage diagnostics helper.
4. Measure real browser storage size by key.
5. Move proposal output draft persistence to IndexedDB.
6. Migrate compose draft persistence off document-scale `localStorage`.
7. Shrink the `cvDocuments` library index so it no longer mirrors full documents.
8. Re-profile `/proposal`.
9. Only then start the next UI pass.

## Implemented First Pass

This plan now has a first concrete implementation in the local codebase:

- proposal output draft stops hammering `localStorage` after the first quota failure in a tab session
- CV document cache now writes the current `cv:` key and removes the legacy `cv-doc:` duplicate
- CV library persistence now keeps `cvDocuments` as the current key and removes the legacy `cvLibrary` duplicate
- CV provider mount now migrates legacy `cvLibrary` and `cv-doc:` entries into the current keys and clears the duplicates
- Proposal Forge attached-CV focus refresh now reads the attached snapshot directly instead of rebuilding the full picker list

This is a storage-footprint and hot-path reduction pass, not the final storage architecture.

## Implemented Second Pass

The local codebase now also includes a second lag-reduction pass on the active `/proposal` route:

- `ProposalForge.tsx` no longer stores the full live compose payload in page-level `lastProposalRequest` state on every form watch update
- live brief/style/character-limit rendering now reads from a lightweight `composePreviewValues` snapshot
- compose-draft persistence is batched with a short timeout instead of forcing synchronous page-level churn on each change
- submit, delete, reset, saved-copy, and handoff-restore paths explicitly cancel or replace pending compose-sync work so draft correctness remains intact

What this means:

- the main proposal page should do less render work while the user edits long imported job offers
- this is a real hot-path reduction in active code
- it is still not proof that all remaining lag is solved

## Implemented Third Pass

The local codebase now also includes a sidebar and resume-switch follow-up:

- `Sidebar.tsx` no longer queues resume loads through `requestAnimationFrame(...)`
- `CvLibraryContext.tsx` now reuses the in-memory CV collection before parsing browser storage during `loadCv(...)`
- `Sidebar.tsx` no longer re-reads proposal draft storage during render when it already has synchronized state

This pass is directly aimed at the browser warning path the user reported under `Sidebar.tsx:822`.

## Implemented Fourth Pass

The plan now also has the promised measurement hook:

- `storage-diagnostics.ts` exposes a dev-only browser helper at `window.__DASTI_STORAGE_DIAGNOSTICS__`
- `App.tsx` installs that helper in dev mode
- the helper reports localStorage and sessionStorage key sizes, total bytes, and relevant proposal/CV entries

This does not reduce lag by itself. It exists so the next persistence migration can be driven by measured browser data instead of inference.

## Remaining Highest-Value Next Steps

1. Add a dev storage diagnostics helper that reports browser-storage key sizes.
2. Measure a real heavy browser profile so the largest remaining keys are no longer inferred.
3. Move proposal output drafts to IndexedDB or a server-backed cache.
4. Shrink `cvDocuments` so it no longer mirrors full CV documents when that data is already cached elsewhere.
5. Re-profile `/proposal` after the storage migration.
6. Only then decide whether more React-level optimization is still justified.

## User Guidance Right Now

For your current browser profile:

- clearing site storage may temporarily reduce lag
- but that is only a workaround, not the product solution

For the product roadmap:

- do not rely on users clearing browser storage
- treat current session fallback as a guardrail only
- prioritize storage architecture before more proposal UI work

## Recommended Commit Strategy

Commit now, then continue.

Suggested scope for the current checkpoint:

- proposal reopen fix
- handoff persistence fix
- output-draft immediate submit fix
- output source snapshot restore fix
- quota fallback and session-mode optimization
- focused regression tests
- audit and plan docs

Then start the next change set for storage architecture and lag reduction as a separate commit.
