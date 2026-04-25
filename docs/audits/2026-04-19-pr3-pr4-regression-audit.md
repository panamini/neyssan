# PR3/PR4 Regression Audit Against `codex/settings-layout-selection`

Date: 2026-04-19

## Scope

Audit the current branch on top of the committed PR3/PR4/PR5 resume preview/export work and restore the last known good behavior without reverting the in-progress settings/layout-selection work.

Relevant baseline commits:

- `398bc19e` `test: add PR4 preview planner renderer reproducers`
- `ffe9bb6b` `fix: implement PR4 workshop preview planner renderer`
- `47c8fb06` `fix: tighten PR4 preview renderer boundaries`
- `6ccce8d2` `test: add PR5 export parity reproducers`
- `d3f0556f` `fix: implement PR5 workshop export parity`

## Findings

### Active code

The committed PR3/PR4/PR5 foundation was still healthy:

- preview planner tests were green
- workshop renderer tests were green
- CV workspace preview integration was green
- settings/proposal style-family tests were green

That means the main regression surface was **not** the original PR3/PR4 planner/renderer architecture by itself.

### Real regression surface

The current branch had layered changes on top of PR5 in these preview/export files:

- [my-app/src/features/verbati/VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx)
- [my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx)
- [my-app/src/lib/resume/resumePagination.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/resume/resumePagination.ts)
- [my-app/src/lib/export-renderers.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/export-renderers.ts)

One extra untracked file had also been introduced:

- `my-app/src/lib/resume/workshopResumeMetrics.ts`

### Exact bad boundary

The real regression was in the planner geometry path:

- `resumeTemplates.ts` defines `workshop_resume_onecol_ats` preview geometry as:
  - `topMm: 17`
  - `rightMm: 35`
  - `bottomMm: 35`
  - `leftMm: 18`
  - `liveHeightMm: 245`
- the untracked `workshopResumeMetrics.ts` introduced a second geometry source with:
  - `top: 17`
  - `right: 18`
  - `bottom: 18`
  - `left: 18`
  - derived content height `262`
- `resumePagination.ts` then used that second source for `workshop_resume_onecol_ats`

So the planner stopped honoring the template contract and started inventing a larger usable page height than the template actually declares.

This is the first wrong boundary:

- **page planner geometry drift**

Not:

- settings family wiring
- proposal style persistence
- top-anchored workshop preview stack
- small preview shell inset

## Restored / Kept

### Kept because they are intentional on the current branch

These changes are covered by current tests and were preserved:

- top-anchored workshop preview stack in [VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx)
- workshop canvas using the template-renderer stack path rather than a single-sheet `data-document-page`
- small workspace preview shell inset in [CvForge.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx)
- style-family/settings wiring in:
  - [style.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/style.ts)
  - [styleFamilies.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/layout/styleFamilies.ts)
  - [SettingsPage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/SettingsPage.tsx)
  - [proposalSettings.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/proposalSettings.ts)

### Restored / corrected

1. Removed the second geometry source:
   - deleted `my-app/src/lib/resume/workshopResumeMetrics.ts`

2. Restored planner authority to the template definition:
   - [resumePagination.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/resume/resumePagination.ts) now uses `args.template.preview.liveHeightMm` instead of a custom workshop height constant

3. Realigned the visible workshop page padding with the template contract:
   - [ResumeOneColAtsPage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx) now uses `17mm 35mm 35mm 18mm`

4. Dropped a non-winning export class detour that was not needed for the current branch behavior:
   - [export-renderers.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/export-renderers.ts) no longer carries the temporary workshop layout-class override logic that was introduced during the failed partial revert

## Verification

Ran and passed:

```bash
./node_modules/.bin/vitest run --maxWorkers=1 src/features/verbati/__tests__/VerbatiResumePreview.test.tsx src/features/verbati/resume/__tests__/ResumeTemplateRenderer.test.tsx src/lib/resume/__tests__/resumePagination.test.ts src/pages/__tests__/CvForge.workspace-preview.integration.test.tsx src/features/verbati/__tests__/useBoundVerbatiCvStyle.test.tsx

./node_modules/.bin/vitest run --maxWorkers=1 src/pages/__tests__/SettingsPage.preview.test.tsx src/lib/__tests__/flags.test.ts src/pages/__tests__/ProposalForge.settings-style-roundtrip.test.tsx src/pages/__tests__/ProposalForge.generated-style-sync.test.tsx src/pages/__tests__/CvForge.workspace-mode.test.tsx
```

Results:

- preview/planner/workspace suite: `29 passed`
- settings/proposal/layout suite: `17 passed`

## Handoff

If this regresses again, inspect in this order:

1. [resumeTemplates.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/layout/resumeTemplates.ts)
   - confirm `workshop_resume_onecol_ats` margins and `liveHeightMm`
2. [resumePagination.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/resume/resumePagination.ts)
   - ensure planner budget comes from the template definition, not a second geometry source
3. [ResumeOneColAtsPage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx)
   - ensure rendered page padding matches the same template geometry
4. Only after that, inspect preview shell behavior in [VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx) and [CvForge.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx)

Do not start by reverting the top-anchored workshop preview stack or the settings-family work. Those are current-branch intent and are covered by tests.
