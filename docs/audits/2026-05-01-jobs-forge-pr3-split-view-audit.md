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
- Active page wraps the split grid in a Dasti page header/shell/card (`dasti-page-shell`, `dasti-jobs-layout` with border/radius and capped height), while the skeleton shows a full-height `.jobs` workspace.
- PR3 says below `1024px` collapse to single column; active collapse/state switch is at `< 760px`.
- PR3/skeleton show `Worth+ a shot` selected on initial load; active `matchFilter` initializes to `all`.
- Skeleton rows are low-density button-like list items with `data-active`; active rows are card-like `article` rows with separate side controls/overflow menu. This preserves behavior but is heavier than the skeleton surface.
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

### P1 candidates only

1. Full-height skeleton `.jobs` shell alignment.
2. Mobile collapse breakpoint from `<760px` toward `<1024px`.
3. Default match filter from `all` toward `Worth+ a shot`, if product agrees.
4. Visual lightening of list rows and match panel.

### P2 — polish / follow-ups

1. Consider extracting `JobsFilters`, `JobsListItem`, and/or `JobDetailHeader` only if it improves maintainability; not required for skeleton parity.
2. Refine first-run/empty states and disabled `+ filter`/capture affordances.
3. Audit medium-width ergonomics and keyboard/focus order after any breakpoint change.
4. Keep backend/parser/extension/verdict-engine refactors out of this UI repair line unless a UI test exposes a real integration break.

## Current checkpoint

P0 is complete. Do not start P1 until a candidate above is selected explicitly.
