# Resume Experience Projection And Preview Invalidation Audit

Date: 2026-04-18

## Scope

- [my-app/src/features/verbati/cvDocumentToResumeData.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/cvDocumentToResumeData.ts)
- [my-app/src/features/verbati/VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx)
- [my-app/src/features/verbati/resume/ResumePage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx)
- [my-app/src/lib/normalize-cv.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/normalize-cv.ts)
- [my-app/src/lib/import-recovery.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/import-recovery.ts)
- [my-app/src/lib/authoritative-resume.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts)
- [cv_parser_service/parsing-pipeline.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/parsing-pipeline.md)
- [docs/audits/2026-03-21-experience-upload-list-flicker-audit.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-21-experience-upload-list-flicker-audit.md)
- [docs/audits/2026-03-25-cv-builder-renderer-integration-audit.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-25-cv-builder-renderer-integration-audit.md)

## Executive Summary

Three things are true at once:

1. Swiss Minima pagination itself is not the source of the “only two experience items” symptom.
2. The mini preview still under-invalidate on content growth, so page count and stack height can go stale even when the main workspace preview repaginates correctly.
3. The imported experience projection issue is real, but it is broader than `mapExperience()` alone. The current resume-preview data contract still expects `description` + `responsibilityBullets`, while the normalized/import pipeline preserves rich prose in `responsibilities`.

That means the priority bug is still the mini-preview invalidation boundary. The `responsibilities` blind spot should also be fixed, but it should be treated as a renderer-projection contract gap, not as a one-line local bug in `mapExperience()` only.

## Findings

### P1 — Mini preview invalidation still under-tracks experience content changes

High confidence.

In [VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx:77), `buildResumeDataSignature()` tracks mostly counts and a few root strings:

- `data.summary`
- collection lengths
- `data.experience.length`

It does not include:

- experience bullet counts
- `description` text length
- any flattened `responsibilities` content length
- per-item period/location changes that can affect layout width/height

The signature is then used in the preview recenter/layout key in [VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx:210). So when content grows inside existing experience items without changing `experience.length`, the host-level preview state can remain stale even though Swiss pagination in [ResumePage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx:3407) recalculates pages.

This is still the strongest explanation for:

- workspace preview shows a new page
- mini render does not update page count or stack geometry consistently

### P1 — Imported experience prose can still disappear in the resume-preview projection

High confidence.

The import/normalization pipeline preserves rich experience prose in `responsibilities`:

- [normalize-cv.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/normalize-cv.ts:271)
- [import-recovery.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/import-recovery.ts:927)

But the resume-preview projection in [cvDocumentToResumeData.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/cvDocumentToResumeData.ts:273) only reads:

- `responsibilityBullets`
- `description`

It does not read or flatten `responsibilities`. The filter at [cvDocumentToResumeData.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/cvDocumentToResumeData.ts:286) will drop an experience item entirely when:

- no `position`
- no `company`
- no bullets
- no description

So a prose-only imported entry living in `responsibilities` can still vanish from the resume renderer path.

### P1 — This is not just a `mapExperience()` bug; it reflects a broader renderer contract mismatch

High confidence.

The same blind spot exists in [authoritative-resume.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/authoritative-resume.ts:282), which also reads:

- `responsibilityBullets`
- `achievements`
- `description` / `summary`

and does not read `responsibilities`.

This matches earlier architecture findings:

- [2026-03-25-cv-builder-renderer-integration-audit.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-25-cv-builder-renderer-integration-audit.md:250)
- [2026-03-21-experience-upload-list-flicker-audit.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-21-experience-upload-list-flicker-audit.md:54)

The active codebase already acknowledges that:

- `responsibilities` is the richer source field
- achievements should remain a separate compatibility channel
- downstream preview paths still flatten responsibilities imperfectly

So the right fix is not “read `responsibilities` because we forgot.” The right fix is “define how rich `responsibilities` should project into the resume renderer contract without re-mixing them with achievements.”

### P1 — Swiss Minima is still not hard-limiting experience items

High confidence.

The Swiss paginated path still pushes every `data.experience` item into `blockDefinitions` in [ResumePage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx:3280), and computes `plannedPages` from those blocks in [ResumePage.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx:3407).

So if the symptom appears again, it is more likely caused by:

- stale preview invalidation
- data projection loss before Swiss receives `data.experience`
- a different layout variant

not by a Swiss-specific hard cap.

### P2 — Bottom dead scroll space is likely a viewport/stack geometry issue, not a paginator issue

Medium confidence.

The preview viewport clamp in [VerbatiResumePreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx:232) only clamps to the current `scrollHeight - clientHeight`. If the canvas or stage is oversized relative to the actual rendered page stack, the clamp will preserve blank space rather than removing it.

That means the remaining “more pages -> more dead space below last page” symptom is likely in:

- `stackHeightPx` reporting
- canvas height derivation
- viewport sizing contract

not in the actual block pagination loop.

## Intent Assessment: Is ignoring `responsibilities` intentional?

Partially, but not defensibly complete.

The current design intent seems to be:

- keep `responsibilities` as richer source content in the CV document/editor pipeline
- project only simplified fields into `ResumeData` for the visual resume renderer
- keep achievements separate from responsibilities

That intent is consistent with:

- [cv_parser_service/parsing-pipeline.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/cv_parser_service/parsing-pipeline.md:147)
- [2026-03-21-experience-upload-list-flicker-audit.md](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/docs/audits/2026-03-21-experience-upload-list-flicker-audit.md:59)

But the current implementation is incomplete because the simplified renderer contract has no defined fallback for prose living only in `responsibilities`.

So:

- the separation from achievements is intentional
- dropping `responsibilities` entirely from resume projection is not a sound end state

## TDD Targets

These are the next RED tests to write before touching code.

### T1 — Resume projection preserves prose-only imported experience

Target:

- [my-app/src/features/verbati/cvDocumentToResumeData.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/cvDocumentToResumeData.ts)

RED case:

- structured experience item with:
  - `responsibilities` rich text
  - no `responsibilityBullets`
  - no `description`
- assert `mapCvDocumentToResumeData(...).experience` still returns one item
- assert the prose is flattened into the renderer contract

This test should decide the intended projection shape explicitly:

- either map rich responsibilities into `description`
- or derive bullets from responsibilities
- but not both unless contractually intended

### T2 — Mini preview invalidates when experience text grows without count changes

Target:

- [my-app/src/features/verbati/__tests__/VerbatiResumePreview.test.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/__tests__/VerbatiResumePreview.test.tsx)

RED case:

- render with same `experience.length`
- rerender with larger experience content payload
- assert layout key / viewport recenter dependency changes and updated metrics propagate

This test should specifically cover:

- more bullet text
- more prose text
- same number of items

### T3 — Preview stack clamps to the last rendered page, not the oversized canvas

Target:

- [my-app/src/features/verbati/__tests__/VerbatiResumePreview.test.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/__tests__/VerbatiResumePreview.test.tsx)

RED case:

- mock a stale oversized scroll height after page count shrinks
- assert viewport ends at the real last-page boundary

## Recommended Implementation Order

1. Fix preview invalidation signature first.
2. Fix experience prose projection second.
3. Audit and fix bottom dead-scroll geometry third.
4. Only then do a focused page-break threshold review.

## What Not To Do

- Do not reopen the parser branch for this symptom.
- Do not change Swiss pagination policy before proving invalidation and geometry are correct.
- Do not re-mix responsibilities and achievements into one preview path again.
