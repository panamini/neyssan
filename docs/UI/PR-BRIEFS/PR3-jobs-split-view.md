# PR3 — `refactor(jobs): skeleton split-view jobs workspace`

**Risk:** medium
**Order:** after PR1, independent of PR2
**Estimate:** 1–2 sessions
**Skeleton authority:** [`APP-SKELETON.html` lines 1759–1858](../APP-SKELETON.html)

> **Defensive note for the implementer:** every selector, line range, file path, import, and token quoted in this brief was best-effort against the spec. If active code disagrees, **trust the code, not this brief**. Fix it and call out the correction in the PR description.

---

## 1. What this PR is

Convert the existing ~2.8k-LOC `JobsPage.tsx` into a split-view shell:

- **left list column** (360px wide, sticky filters, item rows with verdict labels),
- **right detail column** (header actions, scrollable body, sticky inline match panel).

The match analysis is **inline**, not a modal. Verdict labels replace numeric percentages everywhere user-visible. Favorites filter and toggle work end-to-end.

What this PR is **not**: a job-fetch refactor, a verdict-engine change, a parser/extension API change.

---

## 2. Files

### Touch

| File | Change |
|---|---|
| `my-app/src/pages/JobsPage.tsx` | Reduce to a split-view shell (≤ 400 LOC). Owns route state and the selected job ID. Renders `<JobsList>` + `<JobDetail>`. |
| `my-app/src/components/jobs/JobsList.tsx` (new) | Left column. Renders sticky filter strip + scrollable item list. |
| `my-app/src/components/jobs/JobsFilters.tsx` (new) | Filter strip — search input + 5 chip buttons. |
| `my-app/src/components/jobs/JobsListItem.tsx` (new) | One row in the list. |
| `my-app/src/components/jobs/JobDetail.tsx` (new) | Right column. Header + body + sticky match panel. |
| `my-app/src/components/jobs/JobDetailHeader.tsx` (new) | Title + sub + 4 action buttons. |
| `my-app/src/components/jobs/JobMatchPanel.tsx` (new) | Inline verdict + explanation + 4 rows + `See full breakdown`. |
| `my-app/src/hooks/useJobsQuery.ts` | Extract list query + filter logic if currently inlined. |
| `my-app/src/hooks/useJobFavorite.ts` | Extract optimistic favorite toggle if currently inlined. |
| `my-app/src/styles/product-jobs.css` | Add the classes listed in §6. |

### Leave alone

| File | Reason |
|---|---|
| Capture/extension API | Frozen unless the brief calls for it. |
| Convex queries / mutations behind `useJobsQuery` | Adapter only — do not refactor server side. |
| Verdict-engine code (whatever produces `Strong / Worth a shot / Maybe / Probably skip`) | Out of scope. |

---

## 3. Visible behavior — line-by-line against APP-SKELETON.html

### 3.1 Layout — lines 1759–1858

```
<section class="app-page" data-page-id="jobs">
  <div class="jobs">
    <div class="jobs__list"> … </div>
    <div class="jobs__detail"> … </div>
  </div>
</section>
```

CSS: `.jobs { display: grid; grid-template-columns: 360px 1fr; height: calc(100vh - var(--topbar-h)); overflow: hidden; }`. Each column scrolls independently.

Below 1024px, collapse to single column with a back-to-list affordance. Track this in `product-jobs.css` with `@media (max-width: 1023px) { … }`.

### 3.2 Sticky filters — lines 1763–1772

```
<div class="jobs__filters">
  <input class="ds-field" placeholder="Search jobs, companies, skills..." />
  <div class="jobs__filters-row">
    <button class="ds-btn ds-btn--sm ds-btn--accent">Worth+ a shot</button>
    <button class="ds-btn ds-btn--sm ds-btn--ghost">★ Favorites</button>
    <button class="ds-btn ds-btn--sm ds-btn--ghost">Remote</button>
    <button class="ds-btn ds-btn--sm ds-btn--ghost">Senior</button>
    <button class="ds-btn ds-btn--sm ds-btn--ghost">+ filter</button>
  </div>
</div>
```

- **`Worth+ a shot`** = "Worth a shot or better" verdict tier filter (selected on initial load — accent variant).
- **`★ Favorites`** — toggles to show only favorites. Selected state uses `--accent` variant, not the ghost variant.
- **`Remote`** — boolean filter on `remote === true`.
- **`Senior`** — boolean filter on `seniority >= senior`.
- **`+ filter`** — opens an anchored DS `Menu` of additional filters (location, skill, posted-within). If the menu primitive is not yet wired, ship the button disabled with `Coming` pill but keep the slot in the row.

Sticky position: `.jobs__filters { position: sticky; top: 0; z-index: 2; background: var(--sf1); }`.

### 3.3 List items — lines 1773–1814

Each item is a `<button class="jobs__item">` with optional `data-active="true"` for the selected row. Layout:

```
<button class="jobs__item" data-active="...">
  <div class="jobs__item-row">
    <span class="jobs__item-title">{role}</span>
    <span class="ds-verdict ds-verdict--{strong|worth|maybe|skip}">
      <span class="ds-verdict__dot"></span>{Verdict text}
    </span>
  </div>
  <span class="jobs__item-company">{company}</span>
  <div class="jobs__item-meta">
    {★ if favorite}{·}{remote/location}{·}{posted-relative}
  </div>
</button>
```

Verdict labels (no percentages anywhere):

| `data-verdict` | Class | Display |
|---|---|---|
| `strong` | `ds-verdict--strong` | `Strong match` |
| `worth` | `ds-verdict--worth` | `Worth a shot` |
| `maybe` | `ds-verdict--maybe` | `Maybe` |
| `skip` | `ds-verdict--skip` | `Probably skip` |

The `★` glyph in `.jobs__item-meta` indicates favorite state. Favorited rows render the star regardless of the active filter.

### 3.4 Detail header — lines 1819–1833

```
<div class="jobs__detail-header">
  <div>
    <div class="jobs__detail-title">{role}</div>
    <div class="jobs__detail-sub">
      <span>{company}</span><span>·</span><span>{location}</span><span>·</span>
      <span class="ds-verdict ds-verdict--{tier}">…{verdict text}</span>
    </div>
  </div>
  <div class="jobs__detail-actions">
    <button class="ds-btn ds-btn--md ds-btn--ghost" title="Favorite" aria-pressed="…">★</button>
    <button class="ds-btn ds-btn--md ds-btn--secondary">Save</button>
    <button class="ds-btn ds-btn--md ds-btn--ghost">View on {sourceHost}</button>
    <button class="ds-btn ds-btn--md ds-btn--primary">Generate proposal<span class="ds-btn__period">.</span></button>
  </div>
</div>
```

- The Favorite button **toggles** favorite state. Use `aria-pressed` for screen readers.
- `Save` adds to "Save for later" library.
- `View on {sourceHost}` opens the original posting in a new tab (`rel="noopener"`).
- `Generate proposal` navigates to `/proposal` with the job pre-selected as job context.
- A `…` overflow menu (formerly active/archived/duplicate) is **out of scope for this PR** unless it currently blocks an existing test. If it does, render it as a DS `Menu` with options (Archive, Duplicate, View source) — do not introduce a new primitive.

### 3.5 Detail body + match panel — lines 1834–1856

```
<div class="jobs__detail-body">
  <div class="jobs__detail-text">…role description, scrollable…</div>
  <aside class="jobs__match">…sticky inline match panel…</aside>
</div>
```

`.jobs__detail-body { display: grid; grid-template-columns: 1fr 320px; gap: var(--s4); }`. The right panel is `position: sticky; top: var(--s4);` so it stays visible while reading the description.

Match panel structure (lines 1843–1854):

1. `<div class="ds-card__eyebrow">Verdict</div>`
2. Verdict pill: `<div class="ds-verdict ds-verdict--{tier}" style="height:auto;padding:6px var(--s3);font-size:var(--ts);">…{verdict text} — {short qualifier}.</div>`
3. **Plain-English explanation** paragraph — `font-size: var(--tx); color: var(--tm2); line-height: var(--lb);`. One sentence, max two.
4. Divider `1px solid var(--border-soft)`.
5. Four rows under `.jobs__match-list`:
   - Skills · text summary
   - Seniority · text summary
   - Location · text summary
   - Gap · text summary
6. `<button class="ds-btn ds-btn--sm ds-btn--accent">See full breakdown</button>` — opens an existing dialog/sheet if one already exists; otherwise no-op for PR3 and a follow-up.

**Never render a numeric percentage.** Each row's value is plain English ("React, TypeScript, GraphQL — strong overlap.") not "78% match".

---

## 4. Keep / Restore / Remove (from `FEATURES-KEEP-VS-REMOVE.md`)

### Keep

- Capture-from-extension API (Chrome primary)
- Paste URL fallback ingestion
- Search across title, company, skills
- Verdict labels: Strong match / Worth a shot / Maybe / Probably skip
- Match analysis: verdict + explanation + skills/seniority/location/gap rows
- Filters: verdict tier, Favorites, Remote, Senior, custom
- Favorite toggle (list rows + detail header)
- Save for later
- View source / original posting
- Generate proposal
- Resume/CV association if the active code already supports it

### Restore

- Jobs paste URL fetcher (in filter/action area or via cmdk)
- Favorites filter chip
- Inline match panel (no modal for normal review)

### Remove

- Modal-first match analysis
- Match progress bars
- Public numeric match percentages (everywhere — list, detail, library cards)

---

## 5. State + data contracts

| State slice | Source | Notes |
|---|---|---|
| Job list | `useJobsQuery({ filters })` | Returns paginated/streamed jobs. Adapter — keep current signature. |
| Selected job | URL param or local state | `?jobId=…` recommended; if active code uses local state, keep parity. |
| Filters | URL params **or** route-state | Either is fine. Search is a controlled input. |
| Favorites | `useJobFavorite(jobId)` | Optimistic toggle, server reconcile. |
| Verdicts | Existing engine | This PR consumes the verdict tier — does not compute it. |

Keep the `JobsPage.layout.contract.test.ts` test passing; if its assertions need to evolve to match the split-view, update them in this PR but document the diff in the PR description.

---

## 6. CSS classes used by this PR

### Already expected to exist (from PR1)

- `.ds-btn`, `.ds-btn--sm`, `.ds-btn--md`, `.ds-btn--primary`, `.ds-btn--secondary`, `.ds-btn--ghost`, `.ds-btn--accent`, `.ds-btn__period`
- `.ds-field`
- `.ds-pill`, `.ds-pill--neutral`, `.ds-pill--accent`
- `.ds-card__eyebrow`

### Added or extended in this PR (in `product-jobs.css`)

- `.jobs` (grid shell)
- `.jobs__list`
- `.jobs__filters`, `.jobs__filters-row`
- `.jobs__items` (scroll container)
- `.jobs__item`, `.jobs__item[data-active="true"]`, `.jobs__item-row`, `.jobs__item-title`, `.jobs__item-company`, `.jobs__item-meta`
- `.jobs__detail`
- `.jobs__detail-header`, `.jobs__detail-title`, `.jobs__detail-sub`, `.jobs__detail-actions`
- `.jobs__detail-body`, `.jobs__detail-text`
- `.jobs__match`, `.jobs__match-list`, `.jobs__match-row`
- `.ds-verdict`, `.ds-verdict__dot`, `.ds-verdict--strong`, `.ds-verdict--worth`, `.ds-verdict--maybe`, `.ds-verdict--skip`
  (these are scoped to `.ds-verdict` namespace and may move to `product.css` if they're reused on Library cards in PR5 — fine either way)

---

## 7. Behavior contracts (testable)

1. `/jobs` renders two columns at desktop widths.
2. Selecting a row in the list updates the detail column synchronously (no full-page transition).
3. Clicking the favorite star in either the list row or the detail header flips the same state. The list row's `★` indicator updates within one render frame.
4. Selecting `★ Favorites` in the filter chip strip shows only favorited jobs. Clearing it restores the previous list.
5. Searching narrows the list across `title`, `company`, and `skills`. Empty search returns the full list.
6. Verdict tier filter (`Worth+ a shot` chip) hides `Probably skip` jobs.
7. Match panel renders inline in the detail body, sticky to the top of the viewport while scrolling the description.
8. No element on `/jobs` displays a `%` character preceded by a digit.
9. Detail header `Generate proposal` button navigates to `/proposal` with the current job ID applied as job context.
10. List shows a verdict label for every job; jobs missing a verdict render `Maybe` (or whatever the verdict engine's default is — do not invent one).

---

## 8. Verification

```bash
rtk pnpm tsc --noEmit
rtk pnpm lint:css
rtk pnpm test --run my-app/src/pages/__tests__/JobsPage*
rtk pnpm test --run my-app/src/components/jobs/__tests__/*
rtk pnpm exec vite build
```

Browser checks (rendered):

- `/jobs` desktop: two-column layout, filters stick, list scrolls independently.
- `/jobs` 1024-width: graceful single-column collapse with back-to-list affordance.
- Favorite toggle round-trips (refresh page — favorite persists).
- Filter chips combine correctly (Favorites + Remote = remote favorites only).
- Match panel sticks while scrolling.
- Generate proposal navigates and seeds context.
- Search across title / company / skills.
- No `%` match score visible anywhere on the page.
- Light + Dark both clean.

---

## 9. Out of scope for PR3

- `…` overflow menu beyond what the existing tests assert.
- See-full-breakdown dialog rebuild (link only; out of scope unless a test demands it).
- Verdict engine changes.
- Browser-extension surface changes.
- Backend filter pipeline.

If active code on `JobsPage.tsx` includes behaviors not listed in `FEATURES-KEEP-VS-REMOVE.md`, surface them in the PR description before deleting.
