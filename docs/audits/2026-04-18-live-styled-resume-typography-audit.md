# Executive summary

- CV URL: `http://127.0.0.1:5173/cv?id=fixture-robert_cooper`
- Audit target: `repo-fixture` (`Robert Cooper`)
- Artifact dir: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final`
- Preview computes expected fonts: **yes**
- /print/resume computes same fonts as preview: **yes**
- Preview likely materializes the selected primary faces: **yes**
- /print/resume likely materializes the same primary faces: **yes**
- Preview vs pre-PDF print screenshot visibly different: **yes**
- Pre-PDF print screenshot vs rasterized PDF visibly different: **yes**
- Preview vs rasterized PDF visibly different: **yes**

# Live preview vs PDF audit

- Request body: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final/ui-export-request.json`
- Worker bootstrap: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final/worker-bootstrap.json`
- Returned export PDF: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final/returned-export.pdf`
- Returned export SHA-256: `109433f47ef585a3c46fcfb8ca08137a0dfe7f288bc3fdeeb49b1877ec8f7f78`
- Returned export declared font families: `none`
- Fixture path: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/lib/parsing/__tests__/fixtures/robert_cooper.json`
- Preview heading/body computed: `Fraunces, Georgia, serif` / `Syne, "Avenir Next", system-ui, sans-serif`
- Print heading/body computed: `Fraunces, Georgia, serif` / `Syne, "Avenir Next", system-ui, sans-serif`
- Preview heading/body primary-face likely: `null` / `null`
- Print heading/body primary-face likely: `null` / `null`
- Preview / print / PDF page counts: `2` / `2` / `2`
- Page-count parity: preview-print=`true`, print-pdf=`true`, preview-pdf=`true`

# First divergence boundary

`preview-to-print-surface-wrapper`

# Exact root cause

- Derived from the live audit chain above. This report records the first boundary where parity stops being true for the same export run.

# Minimal fix

- Resume surface body inheritance was normalized in active preview code, and the audit harness now captures the exact returned PDF bytes plus the worker's mandatory pre-`page.pdf()` screenshot.

# Files changed

- Runtime artifacts are under `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final`.

# Tests / verification

- Preview vs print diff JSON: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final/diff-preview-vs-print.json`
- Print vs raster diff JSON: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final/diff-print-vs-raster.json`
- Preview vs raster diff JSON: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/tmp/resume-font-parity/manual-robert-cooper-final/diff-preview-vs-raster.json`
- Provided viewed PDF verification: not provided

# Developer debug note

- The audit saves the exact PDF bytes returned by the real click, not a replay response.
- The pre-`page.pdf()` screenshot is emitted by the worker itself on every audit run.
