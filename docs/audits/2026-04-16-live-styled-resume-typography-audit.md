# Executive summary

- CV URL: `http://127.0.0.1:5173/cv?id=fixture-robert_cooper`
- Audit target: `repo-fixture` (`Robert Cooper`)
- Artifact dir: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z`
- Preview computes expected fonts: **yes**
- /print/resume computes same fonts as preview: **yes**
- Preview likely materializes the selected primary faces: **yes**
- /print/resume likely materializes the same primary faces: **yes**
- Preview vs pre-PDF print screenshot visibly different: **no**
- Pre-PDF print screenshot vs rasterized PDF visibly different: **no**
- Preview vs rasterized PDF visibly different: **no**

# Live preview vs PDF audit

- Request body: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z/ui-export-request.json`
- Worker bootstrap: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z/worker-bootstrap.json`
- Returned export PDF: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z/returned-export.pdf`
- Returned export SHA-256: `3d7475688c6117f5e2b2b2a8820099bf812f1923a1c3d133a07e475d560a2b39`
- Returned export declared font families: `Fraunces, Syne`
- Fixture path: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/lib/parsing/__tests__/fixtures/robert_cooper.json`
- Preview heading/body computed: `Fraunces, Georgia, serif` / `Syne, "Avenir Next", system-ui, sans-serif`
- Print heading/body computed: `Fraunces, Georgia, serif` / `Syne, "Avenir Next", system-ui, sans-serif`
- Preview heading/body primary-face likely: `null` / `null`
- Print heading/body primary-face likely: `null` / `null`

# First divergence boundary

`no-divergence-detected`

# Exact root cause

- Derived from the live audit chain above. This report records the first boundary where parity stops being true for the same export run.

# Minimal fix

- Resume surface body inheritance was normalized in active preview code, and the audit harness now captures the exact returned PDF bytes plus the worker's mandatory pre-`page.pdf()` screenshot.

# Files changed

- Runtime artifacts are under `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z`.

# Tests / verification

- Preview vs print diff JSON: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z/diff-preview-vs-print.json`
- Print vs raster diff JSON: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z/diff-print-vs-raster.json`
- Preview vs raster diff JSON: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/resume-font-parity/2026-04-16T03-32-59-859Z/diff-preview-vs-raster.json`
- Provided viewed PDF verification: not provided

# Developer debug note

- The audit saves the exact PDF bytes returned by the real click, not a replay response.
- The pre-`page.pdf()` screenshot is emitted by the worker itself on every audit run.
