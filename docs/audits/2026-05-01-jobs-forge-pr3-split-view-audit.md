# Jobs Forge PR3 split-view audit

Date: 2026-05-01  
Scope: `/jobs` only. Audit plus P0 checkpoint recorded.

## References

- UI authority: `docs/UI/APP-SKELETON.html`, Jobs split-view section.
- Matching brief: `/Volumes/video/git/skill-git/frontend-templates-perso/gpt-pro/9-final/UI/PR-BRIEFS/PR3-jobs-split-view.md`.
- Active route: `my-app/src/App.tsx` routes `/jobs` and `/jobs/:jobId` to `JobsPage`.

## Active route and components

- `my-app/src/pages/JobsPage.tsx` is the active page shell and delegates to `JobsWorkspacePage`.
- `my-app/src/components/jobs/JobsWorkspace.tsx` is the active container. It owns route selection, filters/sort/search state, mobile list/detail state, Convex/Clerk data access, optimistic favorite/review/activity updates, archive/restore/delete/duplicate, resume attach/detach, match refresh, and proposal creation navigation.
- Active child components:
  - `JobsList.tsx`: left pane, search/sort, active/archived toggle, match/docs/review/favorites/remote/senior filters, capture actions, rows, row favorite/menu actions.
  - `JobDetail.tsx`: right pane, detail header/actions, resume picker, source/favorite/proposal actions, editable/review job brief content, match aside.
  - `MatchReadBlock.tsx`: adapts current match read/review data into the panel.
  - `JobMatchPanel.tsx`: inline verdict panel with verdict labels, explanation, Skills/Seniority/Location/Gap rows, and inline breakdown expansion.
- Styling lives primarily in `my-app/src/styles/product-jobs.css` under `dasti-jobs-*`, `dasti-job-match-panel-*`, and `ds-verdict*` selectors.

## Active vs legacy UI

- Active UI is already a split workspace, not the old monolithic `JobsPage` implementation described by PR3 as pre-refactor state.
- No duplicate active Jobs page tree was found: the route enters `JobsPage` -> `JobsWorkspacePage` -> `JobsList` + `JobDetail`.
- Legacy/inactive surfaces are primarily documentation and brief references to skeleton class names/components (`.jobs__*`, `JobsFilters`, `JobsListItem`, `JobDetailHeader`) that are not the active implementation names.
- The active route still carries some cross-route styling names in the match panel (`dasti-proposal-sheet`), but this is active styling reuse rather than a separate legacy Jobs surface.

## Skeleton / PR3 alignment

Already aligned:

- Desktop split-view exists with `grid-template-columns: 360px minmax(0, 1fr)`.
- P0 skeleton aliases are complete: active split-view surfaces now expose `jobs`, `jobs__list`, `jobs__detail`, and `jobs__match` while retaining the existing `dasti-*` behavior/styling hooks.
- Left pane filters are sticky and the job list scrolls independently.
- Right pane contains selected job detail inline; selecting a row updates the detail route/pane rather than opening a modal-first review flow.
- Match analysis is inline and sticky inside the detail body.
- Public match UI uses labels such as `Strong match`, `Worth a shot`, `Maybe`, and `Probably skip`; public percentage copy is avoided in the list/detail/match panel. Score numbers remain in internal/debug panels only.
- Favorites work from both row and detail header, with a Favorites filter.
- `Remote`, `Senior`, `Paste URL`, `Capture with extension`, and `Generate proposal` affordances are present.
- Mobile has a single-column/detail mode with `Back to jobs`.

Gaps vs `APP-SKELETON.html` / PR3:

- Class contract is partially aligned after P0: active code now exposes the requested `.jobs`, `.jobs__list`, `.jobs__detail`, and `.jobs__match` aliases, but still does not expose the full optional skeleton set such as `.jobs__filters`, `.jobs__items`, and `.jobs__item`.
- P1 aligned the active shell closer to the full-height `.jobs` skeleton workspace while preserving the Dasti page shell/chrome.
- P1 moved the collapse breakpoint toward the PR3 contract: active list/detail collapse now uses `<1024px`.
- Deferred default filter contract: PR3/skeleton show `Worth+ a shot` selected on initial load, but active `matchFilter` intentionally remains `all`. Revisit later as a separate product decision slice.
- P1 lightened list row surface density toward skeleton list items while preserving the active row structure and controls.
- Skeleton detail header is a distinct `jobs__detail-header` surface with title/sub/actions; active uses `dasti-jobs-detail__topline` and inline header actions inside the title row.
- Skeleton match panel uses `.jobs__match` with compact card styling and top `0`; active uses `dasti-proposal-sheet dasti-match-read dasti-job-match-panel` and sticky top `var(--space-4)`.

## Repair plan

### P0 — non-behavioral skeleton contract tightening — complete

Commit: `8bd139597 feat(jobs): expose skeleton split-view aliases`

Completed:

1. Added skeleton-compatible alias classes to active Jobs surfaces without changing route behavior:
   - root/grid: `jobs`
   - list pane: `jobs__list`
   - detail pane: `jobs__detail`
   - match panel: `jobs__match`
2. Added focused contract coverage in `my-app/src/__tests__/JobsPage.layout.contract.test.ts` proving the active `/jobs` split-view exposes the requested skeleton aliases.
3. Intentionally preserved current Jobs behavior: filters, routing, mobile breakpoint, visual styling, and data loading are unchanged.
4. Verification passed:
   - `rtk npm test -- src/__tests__/JobsPage.layout.contract.test.ts`
   - `rtk npx tsc --noEmit --pretty false`
   - `rtk git diff --check -- my-app/src/components/jobs/JobsWorkspace.tsx my-app/src/components/jobs/JobsList.tsx my-app/src/components/jobs/JobMatchPanel.tsx my-app/src/__tests__/JobsPage.layout.contract.test.ts`

### P1 checkpoint

Completed:

1. Full-height skeleton `.jobs` shell alignment.
   - Commit: `7e1453fcb feat(jobs): align split-view shell breakpoint`
2. Mobile collapse breakpoint moved from `<760px` toward `<1024px`.
   - Commit: `7e1453fcb feat(jobs): align split-view shell breakpoint`
3. Visual lightening of list rows and match panel.
   - Commit: `ccc57195f feat(jobs): lighten split-view surfaces`

Deferred:

- Default match filter contract. Current default filter stays `all`. The PR3/skeleton `Worth+ a shot` default alignment is intentionally not done yet and should be revisited later as a separate decision slice.

### P2 — polish / follow-ups

1. Consider extracting `JobsFilters`, `JobsListItem`, and/or `JobDetailHeader` only if it improves maintainability; not required for skeleton parity.
2. Refine first-run/empty states and disabled `+ filter`/capture affordances.
3. Audit medium-width ergonomics and keyboard/focus order after any breakpoint change.
4. Keep backend/parser/extension/verdict-engine refactors out of this UI repair line unless a UI test exposes a real integration break.

## Current checkpoint

P0 and the selected P1 shell/breakpoint plus visual-density slices are complete. The remaining default filter contract is deferred: keep `all` until product explicitly chooses `Worth+ a shot` as the initial Jobs filter.
