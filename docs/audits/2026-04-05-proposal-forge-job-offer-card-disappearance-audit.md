# Proposal Forge job-offer card disappearance audit

Date: 2026-04-05

## Scope

Investigated the active Proposal Forge path for the independent job-offer/source card in:

- `src/pages/ProposalForge.tsx`
- `src/components/ProposalInputForm.tsx`
- `src/components/ProposalBriefCard.tsx`
- `src/lib/proposal-source-summary.ts`
- `src/styles/product.css`

## Active code

### Source URL entry

- Extension/import handoff stores `sourceUrl` and `platform` in Convex:
  - `convex/proposalHandoffs.ts:8-35`
- Proposal Forge reads that handoff and maps it to `prefill`:
  - `src/pages/ProposalForge.tsx:696-705`
- Proposal Forge persists the imported source into the compose draft and `composePreviewValues`:
  - `src/pages/ProposalForge.tsx:709-729`

### Source storage and preservation

- Live proposal state preserves `sourceUrl/platform` when building compose snapshots:
  - `src/pages/ProposalForge.tsx:1410-1436`
- Proposal persistence metadata also reads `sourceUrl/platform` from live draft state first:
  - `src/pages/ProposalForge.tsx:1067-1086`

### Compose-shell independent card

- `ProposalInputForm` renders the independent job-offer card before any structured summary:
  - `src/components/ProposalInputForm.tsx:1536-1566`
- The card is not filtered by `buildProposalSourceSummary`; it only depends on `importedSourceLabel`.

### Collapsed brief card

- Proposal Forge computes `briefSourceUrl/platform` and passes them to `ProposalBriefCard`:
  - `src/pages/ProposalForge.tsx:2615-2624`
  - `src/pages/ProposalForge.tsx:3159-3167`
- `ProposalBriefCard` only renders the source row when `formatBriefSourceLabel(...)` returns a truthy label:
  - `src/components/ProposalBriefCard.tsx:44-45`
  - `src/components/ProposalBriefCard.tsx:79-90`

## Root cause

The disappearance is state-related, not visual.

The active bug is that the source card render path does not consistently read from the live draft state that already preserves `sourceUrl/platform`.

### Brief card

- `briefJobDescription` uses `composePreviewValues` first.
- `briefSourceUrl` and `briefSourcePlatform` do **not** use `composePreviewValues` or `outputSourceComposeDraft`; they only use `prefill` or a fresh `readStoredProposalComposeDraft()` call.
- Relevant lines:
  - `src/pages/ProposalForge.tsx:2610-2624`

This means the brief can still have the current job description from live state while losing the source link if local storage is empty, stale, or temporarily out of sync.

### Compose shell card

- `ProposalInputForm` derives `draftSourceUrl/platform` from `prefill` or `readStoredProposalComposeDraft()`.
- Those values are wrapped in `useMemo` keyed only on `prefill?.sourceUrl` / `prefill?.platform`.
- Relevant lines:
  - `src/components/ProposalInputForm.tsx:1186-1203`

So the compose-shell card is coupled to a one-off storage snapshot rather than the current live draft state. If source metadata changes outside `prefill` after mount, the card can disappear or stay stale even though the URL still exists elsewhere in the live proposal state.

## What is not causing it

### Not summary filtering

- The independent job-offer card in `ProposalInputForm` renders before the structured summary block.
- `hasStructuredSourceSummary` only gates the structured summary section, not the job-offer card.

### Not source-summary parsing failure

- `buildProposalSourceSummary(...)` affects metadata chips and extracted summary content only.
- The source card label/host come from `sourceUrl/platform`, not summary parsing.

### Not LinkedIn being renamed to `web`

- Both source-label helpers explicitly ignore generic `web/site/website` labels and fall back to hostname parsing from `sourceUrl`.
- Relevant lines:
  - `src/components/ProposalInputForm.tsx:248-285`
  - `src/components/ProposalBriefCard.tsx:13-31`
- Existing tests already cover this expected behavior:
  - `src/components/__tests__/ProposalInputForm.provider-busy.test.tsx:626-645`

### Not CSS hiding/clipping

- The relevant CSS only defines layout/typography for the source card and source row.
- No conditional hide/clipping rule explains the disappearance.
- Relevant lines:
  - `src/styles/product.css:3603-3665`
  - `src/styles/product.css:8999-9182`

## Minimal fix

Use the same live source-of-truth for source metadata that the page already maintains for persistence:

1. In `ProposalForge.tsx`, compute `briefSourceUrl/platform` with the same precedence as `buildStoredProposalComposeDraftSnapshot(...)`:
   - `outputSourceComposeDraft`
   - `composePreviewValues`
   - stored compose draft
   - `prefill`
2. In `ProposalInputForm.tsx`, stop deriving source visibility from a one-time storage read.
   - Smallest safe option: pass `sourceUrl/platform` in from `ProposalForge` as props sourced from live draft state.
   - If props are avoided, the fallback option is to at least include a live in-memory source (for example `initialComposeDraft`) ahead of storage, but that is weaker than using explicit live props.

## Legacy but informative code

- `src/pages/ProposalForgeNext.tsx`
  - Informative only. The app route redirects `/proposal-next` to `/proposal`, so this is not the active path.
  - Route evidence: `src/App.tsx:302-303`

## Obsolete/dead code

- `src/proposainputform.bak`
  - Backup file, not imported by the active app.

## Risk ranking

1. Most likely: live-state/render-source mismatch in `ProposalForge.tsx` and `ProposalInputForm.tsx`
2. Secondary: conditional rendering guard hides the row once that stale source lookup returns null
3. Low: malformed URL normalization causing a generic label, not disappearance
4. Very low: mode switching itself
5. Very low: async generation replacing state
6. Very low: CSS hiding/clipping
