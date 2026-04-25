# Resume Pagination Audit

Date: 2026-04-18
Branch: `pagination`

## Scope

- Active code only
- Focused files:
  - `my-app/src/features/verbati/resume/ResumePage.tsx`
  - `my-app/src/features/verbati/resume/resume-preview.css`
- Downstream parity notes:
  - `my-app/src/pages/ResumePrintPage.tsx`
  - `my-app/scripts/document-export-worker.ts`
  - `my-app/scripts/run-resume-font-parity-harness.ts`

## Active Code Path

### Preview path

1. `VerbatiResumePreview` mounts exactly one `ResumePage` inside a single document stage sized from `stageLayout.pageWidth/pageHeight`.
   - See `my-app/src/features/verbati/VerbatiResumePreview.tsx:500-518`
2. The live preview surface is still a single preview stage.
   - See `my-app/src/features/verbati/VerbatiResumePreview.tsx:579-589`
3. `ResumeVariantPage` dispatches `swissminima` to `SwissMinimaPage`.
   - See `my-app/src/features/verbati/resume/ResumePage.tsx:4505-4533`

### Swiss Minima path

`SwissMinimaPage` renders one `<article className="resume-page">` and fills it with one absolutely positioned inner grid.

- Outer single-page shell:
  - `my-app/src/features/verbati/resume/ResumePage.tsx:2570-2588`
- Inner grid:
  - `my-app/src/features/verbati/resume/ResumePage.tsx:2588-2598`
- Grid row contract:
  - `gridTemplateRows: "auto auto minmax(0, 1fr) auto"`
  - This is the whole bug.

### CSS shell

The CSS enforces a one-page A4 card:

- `.resume-page { height: var(--page-height); overflow: hidden; }`
  - `my-app/src/features/verbati/resume/resume-preview.css:391-457`
- `.resume-page-stage { height: var(--preview-stage-height); }`
  - `my-app/src/features/verbati/resume/resume-preview.css:176-183`
- `usePreviewScale()` also publishes only one page of stage height.
  - `my-app/src/features/verbati/resume/ResumePage.tsx:142-199`
- `useAutoFitPage()` is currently a no-op and does not measure or paginate anything.
  - `my-app/src/features/verbati/resume/ResumePage.tsx:202-208`

## Root Cause

### 1. This is structurally a fixed one-page renderer

The preview and Swiss Minima implementation assume one A4 page end to end:

- one preview stage
- one `.resume-page`
- one fixed `--page-height`
- one fixed `--preview-stage-height`
- no page planner
- no page count
- no overflow handling

This is not a paginated document renderer. It is a single-page composition shell.

### 2. Swiss Minima hardcodes four vertical rows into one page

Swiss Minima lays out the page as:

1. header
2. summary
3. experience section
4. support row

The implementation is:

- header row: `ResumePage.tsx:2600-2717`
- summary row: `ResumePage.tsx:2719-2753`
- experience row: `ResumePage.tsx:2755-2887`
- support row: `ResumePage.tsx:2889-2950`

The critical detail is the inner grid definition:

- `gridTemplateRows: "auto auto minmax(0, 1fr) auto"`
  - `ResumePage.tsx:2595-2597`

That means:

- header consumes whatever height it needs
- summary consumes whatever height it needs
- support row still reserves its own `auto` row
- experience is forced into the remaining `1fr` slot

Once the experience row needs more than the remaining space, nothing repaginates. The experience content just overdraws into the space where the support row is also being laid out.

### 3. The overlap is structural, not cosmetic

The overlap in the screenshot is not a spacing bug. It happens because:

- the experience section renders inside the third row as a normal grid
  - `ResumePage.tsx:2755-2887`
- support sections render unconditionally in the fourth row if they exist
  - `ResumePage.tsx:2889-2950`
- the outer page clips only at the page edge
  - `resume-preview.css:391-457`

So when an oversized experience item grows taller than the remaining third-row height:

- it visually intrudes downward
- the support row is still rendered below it
- the two regions coexist in the same clipped page box

That is the exact failure shown in the screenshots.

### 4. Support sections are prebuilt as one terminal row

Swiss Minima constructs `supportSections` first, then renders all of them together in one three-column block:

- support section data build starts at `ResumePage.tsx:2151`
- support row render happens at `ResumePage.tsx:2889-2950`

That means the current implementation has no way to:

- move only later support sections
- move the support row as a whole to page 2
- let later experience items spill to page 2 before support sections

The entire support region is treated as “the last row of page 1”.

### 5. The current Swiss Minima implementation is already truncation-oriented

Swiss Minima is not only unpaginated; it is also explicitly condensed:

- summary is line-clamped to 5 lines
  - `ResumePage.tsx:2732-2751`
- experience is limited to the first 3 items
  - `ResumePage.tsx:2785`
- each experience item only shows the first 3 bullets
  - `ResumePage.tsx:2843`

So even before overlap, this template is operating like a “single-page curated composition”, not a true long-document renderer.

## Minimal-Safe Pagination Architecture

Your recommended order is correct:

1. fix pagination
2. polish spacing
3. add regression coverage

The minimal-safe patch should be SwissMinima-first and block-first.

### Goal

Keep the current visual language and tokens, but replace the one-page composition contract with:

- logical blocks
- section/item boundary pagination
- multiple `.resume-page` nodes

Do not globally shrink typography to make content fit.

## Proposed Patch Plan

### Phase 1: Add a real page planner

Introduce a pure planner, not DOM-measured first:

`paginateResumeBlocks({ blocks, pageHeightMm, policy, maxPages, rules }) => PlannedPage[]`

For Swiss Minima v1, use logical blocks:

- `header`
- `summary`
- `experienceHeading`
- `experienceItem`
- `supportRow`

Design the API now so it can later support both document policies:

- `policy: "full" | "one-page-priority"`
- `maxPages?: number`
- `sectionPriorityRules?: ...`

For this patch, only implement and use:

- `policy: "full"`

Do not add a toggle, do not add truncation UI, and do not implement priority-mode truncation behavior in this PR.

Use canonical token geometry from the existing variant tokens:

- page height: `--page-height`
- live area height: `tokens.geometry.page.liveArea.heightMm`
- spacing/rhythm tokens from `normalizeResumePreviewTokens()`

This stays consistent with the current template system and avoids fragile DOM probing.

### Phase 2: Move Swiss Minima to blocks-first

Refactor `SwissMinimaPage` so it does not directly compose one final `<article>`.

Instead:

1. build ordered blocks
2. paginate blocks
3. render `pages.map(...)`

The first cut does not need to generalize all variants.

Implement Swiss Minima first, prove the pattern, then reuse it elsewhere.

### Phase 3: Paginate at section/item boundaries

For v1:

- keep each experience item atomic
- keep each support row atomic
- if a block does not fit, move it to the next page

That is the safest first pass and matches the screenshoted failure exactly.

The important architectural constraint is:

- the same planner should later be able to stop at `maxPages: 1` and apply priority rules
- but this PR should always paginate fully until all content has been placed

#### Important Swiss-specific rule

The support row must never coexist with an overflowing experience row.

If there is not enough room for the support row after experience items:

- move the support row to page 2

If later experience items also do not fit:

- move later experience items to page 2 before the support row

This rule alone removes the exact overlap shown in the screenshots.

### Phase 4: Render multiple `.resume-page` nodes

Once the planner returns pages, render:

`pages.map(page => <article className="resume-page">...</article>)`

instead of a single article.

The lowest-risk way to do that in preview is:

- keep `PreviewFrame`
- add a `resume-page-stack` wrapper inside `.resume-page-stage`
- render one scaled `.resume-page` per planned page

### Phase 5: Update stage sizing for multi-page preview

Today the preview stage assumes one page:

- `usePreviewScale()` publishes one `--preview-stage-height`
  - `ResumePage.tsx:192-199`
- `.resume-page-stage` uses that single height
  - `resume-preview.css:176-183`

Change that contract to:

- `usePreviewScale(pageCount, pageGapPx?)`
- compute `--preview-stage-height` from total stacked page height
- add `--preview-page-gap`
- render pages inside a wrapper grid

Recommended CSS direction:

- `.resume-page-stage`
  - size to stacked height
  - align content to start
- `.resume-page-stack`
  - `display: grid`
  - `justify-items: start`
  - `align-content: start`
  - `gap: var(--preview-page-gap)`
- `.resume-page-stage .resume-page`
  - keep per-page scaling behavior

## Swiss Minima-Specific Structural Recommendation

### Block model

For Swiss Minima, define:

- `headerBlock`
- `summaryBlock`
- `experienceHeadingBlock`
- `experienceItemBlock[]`
- `supportSectionBlock[]`

Then group support sections into rows of up to 3 columns:

- `supportRows = groupSupportSectionsIntoRows(sections, 3)`

Each `supportRow` becomes one atomic paginated block.

This preserves the current visual structure:

- page 1 can still end with a 3-column support row when it fits
- page 2 can start with that row unchanged when it does not

### Continuation rule

If page 2 starts with moved experience items, repeat the small “Experience” label at the top of that page.

That can be implemented by allowing the planner to inject:

- `experienceHeadingBlock`

before the first experience item on any page where experience continues.

This is preferable to trying to split an oversized item or shrinking type.

## Components / Functions To Introduce Or Refactor

These can start in `ResumePage.tsx` and be extracted later if they stabilize.

### Introduce

- `type ResumePlannedPage`
- `type ResumePlannedBlock`
- `type SwissMinimaBlock`
- `type ResumePaginationPolicy = "full" | "one-page-priority"`
- `type ResumePaginationOptions = { policy: ResumePaginationPolicy; maxPages?: number; sectionPriorityRules?: ... }`
- `buildSwissMinimaBlocks(data, activeTarget)`
- `groupSwissMinimaSupportRows(sections, columnsPerRow = 3)`
- `estimateSwissMinimaBlockHeightMm(block, tokens)`
- `paginateResumeBlocks({ blocks, pageHeightMm, policy, maxPages, rules })`
- `renderSwissMinimaPlannedPage(page, context)`
- `ResumePageStack`

### Refactor

- `SwissMinimaPage`
  - from “render one article directly”
  - to “plan blocks -> paginate -> render pages”
- `usePreviewScale`
  - accept page count and total stacked height
- `PreviewFrame`
  - support multiple page children cleanly

### Keep as-is in v1

- current typography tokens
- current Swiss visual rules
- current support section content renderers
- no one-page priority toggle
- no truncation UI
- no section-dropping behavior

The first patch should change page composition, not redesign the template.

## Downstream Follow-Ups Required For Preview / Export Parity

Even though the core fix starts in `ResumePage.tsx` and `resume-preview.css`, preview/export parity requires downstream updates after multi-page rendering lands.

### Print route

`ResumePrintPage` still hardcodes a single A4 `PRINT_STAGE_LAYOUT`.

- `my-app/src/pages/ResumePrintPage.tsx:40-51`

After pagination exists, the print route must publish stacked page height the same way proposal print already does.

### Export audit worker

The worker still screenshots one `.resume-page`:

- `my-app/scripts/document-export-worker.ts:338-375`

It must capture all pages, not just the first matched page.

### Harness

The parity harness also screenshots only the first `.resume-page`:

- `my-app/scripts/run-resume-font-parity-harness.ts:504-506`

That needs to become page-stack aware once the feature exists.

## Test Plan

Do this after the pagination patch, not before.

### 1. Pure planner tests

Add unit tests for the new planner:

- long experience items push later items to page 2
- support rows move intact to page 2 when page 1 is full
- support rows never render before displaced experience items that should stay earlier in reading order
- section headings do not orphan without at least one child item

### 2. Swiss Minima component tests

Add `ResumePage` tests with oversized `ResumeData`:

- renders more than one `.resume-page` for Swiss Minima
- page 1 contains header, summary, first experience items
- page 2 contains overflow experience items and/or support row
- support row does not render on page 1 when page 1 lacks room

### 3. Preview stage tests

Add focused tests for the stage wrapper:

- `resume-page-stage` height tracks total page count
- stacked pages render in order
- page gap is stable in panel and workspace preview modes

### 4. Print parity tests

After preview is fixed:

- `ResumePrintPage` should render the same number of `.resume-page` nodes as preview for the same payload
- export worker audit screenshot should include all pages
- rasterized PDF page count should match planned page count

## Recommended Patch Order

1. Swiss Minima page planner and multi-page rendering
2. Preview stage and CSS updates for page stacks
3. Print-route parity update
4. Export-worker and harness multi-page audit updates
5. Spacing polish only after the pagination model is correct

## Conclusion

The screenshoted overlap is not caused by slightly-wrong spacing. It is caused by a one-page composition system being asked to behave like a paginated document renderer.

The minimal-safe fix is:

- keep Swiss Minima visually the same
- add a real block/page planner
- paginate at section/item boundaries
- render multiple `.resume-page` nodes

That is the correct fix order. Shrinking typography globally would only hide the current defect and would not solve the structural problem.
