# Resume Preview Measure Shell Scroll Boundary Fix

Date: 2026-04-18

## Status

Implemented on `pagination`, not yet committed at the time of writing.

Relevant files:

- [my-app/src/features/verbati/resume/resume-preview.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css)
- [my-app/src/features/verbati/resume/__tests__/resume-preview.css.test.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/__tests__/resume-preview.css.test.ts)

## Problem

The CV workspace preview could scroll into blank space below the last resume page.

This was still reproducible after earlier Swiss preview metric cleanup. The live bug remained visible in the actual workspace viewport, so the winning boundary was not the Swiss page-count math alone.

## Root Cause

The hidden `.resume-page-measure-shell` used by Swiss pagination measurement was still part of the live preview layout tree.

Before this fix:

- the measurement shell was `position: absolute`
- it was moved offscreen with `left: -200vw`
- it remained hidden visually
- but it could still contribute to ancestor `scrollHeight`

That meant the workspace viewport could scroll the hidden measurement content in addition to the real rendered page stack.

## Live Proof

Headless browser inspection against the real CV workspace path showed the mismatch clearly on a 2-page Swiss preview.

Before the fix:

- viewport `scrollHeight`: about `4217px`
- rendered stack height: about `1818px`

After the fix:

- viewport `scrollHeight`: `1818px`
- canvas `scrollHeight`: `1818px`
- stage/frame `scrollHeight`: `1818px`
- page count remained `2 pages`

So the blank tail was caused by the hidden measurement shell inflating the host scroll boundary, not by the visible page stack itself.

## Decision

Keep the measurement shell available for deterministic Swiss pagination measurement, but isolate it from the live scroll tree.

Implemented change:

- change `.resume-page-measure-shell` from `position: absolute` to `position: fixed`
- keep it offscreen and hidden
- add `contain: layout paint`

This preserves measurement behavior while removing the shell from ancestor scroll calculations in the workspace viewer.

## Validation

Regression coverage:

```bash
my-app/node_modules/.bin/vitest run --maxWorkers=1 src/features/verbati/resume/__tests__/resume-preview.css.test.ts
my-app/node_modules/.bin/vitest run --maxWorkers=1 src/features/verbati/__tests__/VerbatiResumePreview.test.tsx src/pages/__tests__/CvForge.workspace-preview.integration.test.tsx src/pages/__tests__/CvForge.workspace-mode.test.tsx src/features/verbati/resume/__tests__/ResumePage.test.tsx
```

Added contract assertion:

- `.resume-page-measure-shell` must remain `position: fixed`
- it must stay offscreen
- it must keep `contain: layout paint`

## User-Visible Effect

If this fix is working:

- the CV preview should stop exactly at the last rendered page
- multi-page previews should no longer accumulate extra blank scroll space below the stack
- page count and visible page rendering remain unchanged

## Non-Goals

This fix does not change:

- Swiss pagination thresholds
- page-break planning policy
- mini-preview invalidation logic
- zoom or fit behavior outside the blank-space bug
