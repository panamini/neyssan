# DASTI UI Redesign: Main Gap And Preservation Plan

Date: 2026-04-03

## Goal

Compare the validated redesign plan against current `main`, preserve the good progress already shipped, and define the safest next improvement sequence without implementing code yet.

## Branch / Worktree Status

### Removed worktrees with no unique value

The Claude worktrees were reviewed before removal. They had no commits that were unique relative to `main`, so deleting them did not discard code that still needed to be recovered.

### Remaining worktree

- `/private/tmp/neyssan-baseline` is still present as a detached, prunable baseline worktree.
- It is not part of the removed Claude branch set.
- It does not block the redesign plan, but it can be cleaned later if no one needs that baseline snapshot.

## Comparison Summary

### Already complete on `main`

These items from the validated redesign plan are already landed and should be treated as preserved progress, not reworked:

- `my-app/src/styles/foundation.css`
  - `--document-paper-radius: 4px`
  - widened `--document-viewer-bleed-inline`
  - widened `--document-viewer-bleed-block`
  - `--border-selected` in light and dark mode
  - semantic aliases `--color-border-hover` and `--color-border-selected`
  - updated dark neutral, border, and shadow tokens
- saved proposal width fix is already on `main`
  - the selected saved proposal path was previously the main regression area and should not be re-opened casually
- `ProfileReviewCard.tsx`
  - inline import review already exists and is wired to `inspectCvImportSignals`
- `product.css`
  - shared empty-state classes already exist

### Partial progress on `main`

These areas have some redesign work or adjacent infrastructure, but they do not yet match the validated plan:

- `my-app/src/styles/product.css`
  - sidebar styles still use the older visible card border, hover lift, dot marker, and active-row fill treatment
- `my-app/src/lib/cv-import-signals.ts`
  - current checks cover noisy names, repeated summary text, timeline debris, company-name mismatch, title/company inversion, placeholder dates, and duplicated experience text
  - the broader trust-layer checks from the validated plan are not fully present
- `my-app/src/components/ProfileReviewCard.tsx`
  - inline review list exists
  - the separate dismissible warning banner from the validated plan does not exist yet
  - the empty state already uses some stronger shared classes, but the redesign guidance can still be tightened
- `my-app/src/components/ProposalsList.tsx`
  - tone metadata exists in the saved proposal data flow
  - saved library cards still use the older snippet/meta treatment rather than the redesigned tone badge / count-pill path

### Still missing or divergent on `main`

- `my-app/src/features/verbati/resume/resume-layout.spec.ts`
  - resume page radius is still `8mm`
- `my-app/src/styles/product.css`
  - proposal paper selectors still use `var(--document-stage-radius)` instead of a paper-only radius override
- `my-app/src/pages/CvForge.tsx`
  - split preview column is still `clamp(360px, 34vw, 420px)`, which does not reflect the validated “widen split preview column” direction
- `my-app/src/lib/__tests__/cv-import-signals.test.ts`
  - clean fixture still uses the placeholder title `Imported CV`
- `my-app/src/components/ProposalInputForm.tsx`
  - job description textarea still uses `lineHeight: "var(--lb)"`, not `1.65`
- `my-app/src/components/ProposalsList.tsx`
  - `buildProposalSnippet()` still preserves generic salutations like `Dear`, `Hello`, and `Hi`
  - no saved sidebar count pill
  - no saved-card tone badge in the redesign sense

## Risk Classification

### Low-risk and worth doing first

- extend trust-layer detection in `cv-import-signals.ts`
- fix the clean test fixture title in `cv-import-signals.test.ts`
- add a dismissible import warning banner above the existing inline review list
- update the compose textarea line-height in `ProposalInputForm.tsx`
- filter generic salutations out of saved-card snippets in `ProposalsList.tsx`
- add saved proposal count and tone badge UI if kept scoped to the saved proposal list only

### Medium-risk and should be isolated

- sidebar refinement in `product.css`
  - this affects many interactions and can drift beyond the redesign intent if done as a global border sweep
- CV Forge split preview width adjustment in `CvForge.tsx`
  - safe if limited to the split grid only
  - risky if it changes preview behavior in stacked or preview-only mode

### Higher-risk and should be done only after visual verification

- document surface radius changes
  - proposal paper currently shares `--document-stage-radius` at the selector level
  - resume paper radius is controlled separately through `resume-layout.spec.ts`
  - this should be handled with paper-only overrides rather than another global token pass
- any further saved-proposal shell/layout work
  - the selected-card width path was previously unstable
  - avoid touching outer shell sizing unless a concrete regression is measured first

## Preservation Rules

To avoid losing good progress, the next implementation round should follow these rules:

1. Do not reopen the saved proposal width fix unless there is a measured regression in the selected-card width chain.
2. Do not change `--document-stage-radius` globally.
3. Do not widen CV Forge by changing every preview host; scope it to the split-grid column only.
4. Keep the existing inline import review list in `ProfileReviewCard.tsx`; add the warning banner above it instead of replacing it.
5. Treat the token pass in `foundation.css` as baseline, not as work to redo.
6. Keep proposal list changes scoped to the saved proposal library path only.

## Recommended Next Plan

### Phase A: Trust and text quality

Target files:

- `my-app/src/lib/cv-import-signals.ts`
- `my-app/src/lib/__tests__/cv-import-signals.test.ts`
- `my-app/src/components/ProfileReviewCard.tsx`
- `my-app/src/styles/product.css`
- `my-app/src/components/ProposalInputForm.tsx`

Scope:

- add the missing trust-layer checks
- fix the clean fixture title
- add a session-dismissable warning banner above the existing inline review section
- refine empty-state guidance only where it improves the loaded CV review path
- set compose textarea line-height to `1.65`

Why first:

- highest product value
- low blast radius
- does not interfere with the already-correct saved proposal width work

### Phase B: Saved proposal library polish

Target files:

- `my-app/src/components/ProposalsList.tsx`
- `my-app/src/styles/product.css`

Scope:

- remove generic salutations from card snippets
- add tone badge rendering for saved cards
- add saved proposal count pill in the sidebar heading

Why second:

- localized to the saved proposal list path
- improves readability without reopening document renderer layout

### Phase C: CV Forge surface polish

Target files:

- `my-app/src/pages/CvForge.tsx`
- `my-app/src/features/verbati/resume/resume-layout.spec.ts`
- `my-app/src/styles/product.css`

Scope:

- widen only the split preview column in CV Forge
- reduce resume page radius from `8mm` to `1mm`
- add a proposal paper-only radius override for:
  - `.dasti-proposal-sheet__preview-page`
  - `.dasti-document-stage__canvas[data-document-page="true"]`

Why third:

- this is the most visual part of the redesign
- it should be done after the lower-risk trust and proposal-list polish

### Phase D: Sidebar refinement

Target files:

- `my-app/src/styles/product.css`

Scope:

- soften sidebar borders
- remove the default visible workspace-card border
- restore hover border via semantic hover token
- replace the dot marker with the accent bar
- remove active-row fill while preserving hover affordance

Why last:

- broadest visual footprint
- easiest place to create “looks different everywhere” regressions

## Suggested Delivery Strategy

Use small PR-sized slices rather than a single redesign batch:

1. trust layer + warning banner + textarea line-height
2. saved proposal snippet/tone/count polish
3. CV Forge preview width + paper radius adjustments
4. sidebar refinement

That order keeps current `main` usable while still moving toward the validated redesign.

## Final Recommendation

Do not restart from the validated plan as if nothing shipped.

The right approach is:

- preserve the token work already on `main`
- preserve the saved proposal width fix already on `main`
- finish the trust layer first
- polish the saved proposal list second
- isolate document-surface and sidebar work into separate follow-up passes

That gives the redesign forward motion without sacrificing the stable progress already merged.
