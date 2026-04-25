# Experience Projection And Preview Invalidation Audit

Date: 2026-04-18

## Scope
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/cvDocumentToResumeData.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/normalize-cv.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/import-recovery.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/types/cvDocument.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/parsing-pipeline.md`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-21-experience-upload-list-flicker-audit.md`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-25-cv-builder-renderer-integration-audit.md`

## User-facing symptoms reviewed
- Imported experience prose can disappear or look incomplete in resume preview.
- Mini preview can lag behind workspace preview when content grows inside existing sections.
- Page count can appear stale in mini preview even when workspace preview repaginates.
- Scroll can continue below the last page, especially as page count increases.

## Executive summary
- The `responsibilities` question is still relevant, but it is a projection-contract issue, not obviously a one-line bug.
- The highest-priority active issue is still preview invalidation: the mini preview host does not track enough content volume to reliably refresh when pagination changes without section counts changing.
- Swiss Minima is not hard-capping experience items to two entries. If only two entries appear, the issue is upstream of Swiss pagination or in preview projection.
- The extra blank space under the last page is a separate viewer-stack geometry problem, not a parser problem and not proof that page-break logic itself is wrong.

## Pipeline traced

### 1. Parser and import normalization
- The parser pipeline explicitly treats responsibilities and achievements as separate outputs. See `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/parsing-pipeline.md`.
- In active frontend normalization, experience items preserve `responsibilities` as a rich field and derive `responsibilityBullets` secondarily:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/normalize-cv.ts`
- Import recovery also writes recovered prose into `responsibilities`, with bullets optionally mirrored into `responsibilityBullets`:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/import-recovery.ts`
- The document type contract still defines all three experience-body channels:
  - `responsibilities`
  - `responsibilityBullets`
  - `description`
  - File: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/types/cvDocument.ts`

### 2. Resume projection layer
- `mapExperience()` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/cvDocumentToResumeData.ts` only reads:
  - `responsibilityBullets`
  - `description`
- It does not read `responsibilities`.
- If `company`, `position`, bullets, and `description` are all absent after projection, the item is dropped.

### 3. Authoritative resume export layer
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts` has the same flattening pattern:
  - reads `responsibilityBullets`
  - reads `achievements`
  - reads `description` or `summary`
  - does not read `responsibilities`

### 4. Preview invalidation and host refresh
- `buildResumeDataSignature()` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx` tracks:
  - top-level strings such as `name`, `title`, `summary`
  - section counts such as `experience.length`, `projects.length`, `education.length`
  - some item-list counts
- It does not track:
  - experience prose length
  - experience bullet count
  - `responsibilities` rich-text content
  - per-item content changes when item count stays the same
- Result: pagination can change while the mini preview host keeps stale fit/stack assumptions.

### 5. Swiss pagination itself
- Swiss Minima pagination in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx` pushes all `data.experience` entries into `blockDefinitions`.
- The planned pages are computed from those blocks.
- Conclusion: Swiss itself is not the source of a two-item cap.

## Findings

### Finding 1: `responsibilities` is still a live projection mismatch
Classification: active code

The active import/normalization path treats `responsibilities` as canonical rich experience body content. The resume projection path and authoritative export path still flatten experience using only bullets plus description/summary.

This mismatch is real. However, it is not automatically correct to "just map `responsibilities` directly" without deciding how the rich field should flatten into resume preview text:
- as description text
- as derived bullet sentences
- as description fallback only when bullets/description are empty

Why this matters:
- earlier audit `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-21-experience-upload-list-flicker-audit.md` already established that responsibilities should not simply be routed through the achievements-oriented display path.
- responsibilities and achievements are separate concepts in the parser and normalization model.

Assessment:
- still relevant
- not the first fix to make for pagination stability
- should be handled as an explicit projection-contract decision, with tests

### Finding 2: mini preview invalidation is still the priority active bug
Classification: active code

The mini preview still uses a weak resume-data signature. It mostly tracks counts and a few top-level strings. This is insufficient for pagination-sensitive content edits.

Example failure mode:
- user edits prose inside an existing experience item
- `experience.length` does not change
- Swiss pagination changes because content height changes
- workspace preview can reflow
- mini preview host can keep stale stack/fit assumptions because its layout key did not materially change

This exactly matches the class of user reports where:
- page count appears not to update consistently
- mini preview lags the workspace preview
- adding a whole new section may appear to "fix" the issue because counts finally change

Assessment:
- still active
- highest-priority frontend fix before further pagination tuning

### Finding 3: bottom empty scroll space is a separate host geometry bug
Classification: active code

The current clamp logic in `VerbatiResumePreview.tsx` clamps `scrollTop` and `scrollLeft` to current scrollable bounds. That protects against out-of-range positions after shrink, but it does not prove that the scrollable bounds themselves are correct.

If:
- stack height is oversized
- page shell height is wrong
- viewport canvas remains taller than the actual page stack

then the preview will still allow scrolling into blank space below the last page.

Assessment:
- separate from parser issues
- separate from the invalidation signature itself
- should be debugged at the viewer-stack geometry boundary after invalidation is fixed

### Finding 4: Swiss Minima is not the source of a two-experience cap
Classification: active code

Swiss paginated rendering still processes every `data.experience` entry. If only two experiences appear, the likely explanations are:
- wrong renderer variant active
- projection path dropped or flattened entries before Swiss sees them
- stale preview host did not refresh correctly

Assessment:
- the earlier suspicion about Swiss capping experience to two items is not supported by the current code

## Intent assessment: is ignoring `responsibilities` intentional?

Partly intentional, but incomplete.

What appears intentional:
- the app keeps a richer authoring/import model than the flattened resume preview/export model
- the preview layer prefers explicit bullets and descriptions over blindly flattening rich docs
- earlier work intentionally separated responsibilities-rich rendering from achievements-list rendering

What appears incomplete:
- there is no explicit documented rule for how `responsibilities` should degrade into resume-preview/export projection when it is the only populated field
- both `cvDocumentToResumeData.ts` and `authoritative-resume.ts` ignore it completely
- that means imported content can exist in the canonical document model but disappear in flattened resume outputs

Conclusion:
- this is not dead code
- this is not obviously a mistaken omission either
- it is an unresolved contract decision that now causes user-visible gaps

## Recommended order

### 1. Fix mini-preview invalidation first
Why:
- this is the direct cause of stale page-count and stale repagination symptoms
- it is isolated and testable
- it should reduce false positives when evaluating the actual page-break logic

### 2. Audit and fix bottom dead-scroll geometry
Why:
- dead space below the last page is a viewer contract bug
- it is easier to diagnose once invalidation is reliable

### 3. Then decide the `responsibilities` projection contract
Why:
- this is still real
- but it should be solved deliberately, not with a blind field passthrough

### 4. Only after that, tune page-cut thresholds
Why:
- otherwise tuning risks compensating for stale preview state or bad stack geometry

## TDD targets

### RED target A: mini preview invalidates on experience content growth
Add a test proving:
- same `experience.length`
- longer experience prose or more bullets
- preview layout key changes
- metrics/fit refresh path reruns

Suggested file:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/__tests__/VerbatiResumePreview.test.tsx`

### RED target B: imported experience with only `responsibilities` does not disappear
Add a test proving the exact intended contract once chosen:
- if only `responsibilities` exists, projection should still produce usable resume content
- verify whether that becomes description fallback, derived bullets, or another explicit field

Suggested files:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/__tests__/cvDocumentToResumeData.test.ts`
- or extend an existing resume projection test file if one already covers `mapExperience()`

### RED target C: mini preview cannot scroll beyond last page after stack shrink
Add a test proving:
- multi-page stack shrinks
- current `scrollTop` is past the new max
- viewport clamps to actual last-page bound
- no extra blank scroll remains

Suggested file:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/__tests__/VerbatiResumePreview.test.tsx`

## Final recommendation
- Treat `responsibilities` as a still-open projection-contract issue.
- Treat preview invalidation as the immediate bug to fix next.
- Treat blank space below the last page as a separate viewer geometry bug.
- Do not start page-cut tuning until preview invalidation and last-page scroll bounds are stable.
