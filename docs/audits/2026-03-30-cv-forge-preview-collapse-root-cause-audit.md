# CV Forge Resume Preview Collapse Audit

Date: 2026-03-30

Scope:
- active `/cv` preview mode in `my-app`
- responsive transition between framed and narrow page-scroll workspace shells
- visual symptom: the resume page appears to drop inside its own container as the browser narrows

## Active Code Reviewed

- `src/pages/CvForge.tsx`
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/hooks/use-document-stage-layout.ts`
- `src/hooks/use-document-viewport-centering.ts`
- `src/styles/product.css`
- `src/features/verbati/resume/resume-preview.css`

## Legacy But Informative

- older audits under `docs/audits/`

These were treated as informative only. The active code above was the authority.

## Obsolete Or Non-Authoritative

- `pdf-ingest/`
- parser training code
- archive and backup trees
- `*.bak`

These were ignored.

## Trace

`CvForge` switches the preview shell at `760px` from `framed` to `page-scroll` in [`src/pages/CvForge.tsx`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx#L58C1). That is the exact responsive boundary that matches the reported collapse.

In narrow mode, the outer workspace shell in [`src/styles/product.css`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L1812C1) correctly changes the document chassis to page flow and centers the document canvas itself with `margin-inline: auto`.

The problem was lower in the stack. The resume page is rendered as a full A4 layout and visually shrunk with `transform: scale(...)` in [`src/features/verbati/resume/resume-preview.css`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css#L150C1) and [`src/features/verbati/resume/resume-preview.css`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css#L160C1).

That transform means the visual page is smaller than its layout box. So the inner stage must stay top-start anchored. The shared workspace rule now does that explicitly in [`src/features/verbati/resume/resume-preview.css`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css#L227C1).

## Root Cause

The collapse was not a content problem and not primarily a viewport-centering-hook problem.

The real root cause was a page-scroll-specific CSS override in `src/features/verbati/resume/resume-preview.css` that re-centered the inner `.resume-page-stage` for `.dasti-doc-viewer-shell--resume-workspace-page`.

That was wrong because:

- the outer page-scroll shell in `product.css` already centers the scaled document surface
- the inner resume page is transform-scaled from a full A4 layout box
- centering the inner transformed stage makes the page drift inside its own container instead of staying anchored at the top

This is why the page looked like it was falling down inside the preview surface as the browser narrowed.

## Fix

Removed the narrow page-scroll override that was forcing the inner resume frame and stage back to centered alignment.

The preview now keeps a single workspace anchoring rule:

- `.resume-page-frame` stays start-aligned
- `.resume-page-stage` stays `place-items: start`
- the outer page-scroll shell remains responsible for horizontal centering

That preserves the intended top anchor while still allowing the page to sit centered within the overall mobile shell.

## Regression Coverage

Added a focused stylesheet regression in [`src/features/verbati/resume/__tests__/resume-preview.css.test.ts`](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/__tests__/resume-preview.css.test.ts#L1C1).

It guards two things:

- the shared workspace stage remains `place-items: start`
- page-scroll workspace mode does not reintroduce a `.resume-page-stage` `place-items: center` override

## Verification

Ran:

```bash
npx vitest run src/features/verbati/__tests__/VerbatiResumePreview.test.tsx src/features/verbati/resume/__tests__/resume-preview.css.test.ts src/pages/__tests__/CvForge.workspace-mode.test.tsx
```

Result: all three test files passed.
