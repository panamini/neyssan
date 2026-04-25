# Executive summary

- Proposal URL: `http://127.0.0.1:5173/proposal`
- Audit target: `local-compose-fixture` (`proposal_output_draft_fixture`)
- Artifact dir: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/proposal-styled-parity/2026-04-16T03-32-59-746Z`
- Preview computes expected fonts: **yes**
- /print/proposal computes same fonts as preview: **yes**
- Preview vs pre-PDF print screenshot visibly different: **no**
- Pre-PDF print screenshot vs rasterized PDF visibly different: **no**

# Live preview vs styled PDF audit

- Request body: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/proposal-styled-parity/2026-04-16T03-32-59-746Z/ui-export-request.json`
- Worker bootstrap: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/proposal-styled-parity/2026-04-16T03-32-59-746Z/worker-bootstrap.json`
- Returned export PDF: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/tmp/proposal-styled-parity/2026-04-16T03-32-59-746Z/returned-export.pdf`
- Returned export SHA-256: `a47f1d05b0d49e6b5f308b3c93254c141acb5898d06d22aeff82e5ebdb18d032`
- Returned export declared font families: `Fraunces, Syne`
- Preview title/body/contact computed: `Fraunces, Georgia, serif` / `Syne, "Avenir Next", system-ui, sans-serif` / `Syne, "Avenir Next", system-ui, sans-serif`
- Print title/body/contact computed: `Fraunces, Georgia, serif` / `Syne, "Avenir Next", system-ui, sans-serif` / `Syne, "Avenir Next", system-ui, sans-serif`

# First divergence boundary

`no-divergence-detected`

# Exact root cause

- Derived from the same-export artifact chain above.

# Minimal fix

- Styled proposal PDF must render through the same preview-driven print route and the same resolved template/style state used by `ProposalDisplay`.

# Files changed

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/ProposalDisplay.tsx`
- `my-app/src/pages/ProposalPrintPage.tsx`
- `my-app/src/App.tsx`
- `my-app/src/lib/document-export-models.ts`
- `my-app/src/lib/document-export-debug.ts`
- `my-app/src/lib/proposal-font-debug.ts`
- `my-app/src/lib/exportDocumentFile.ts`
- `my-app/scripts/document-export-worker.ts`
- `my-app/scripts/run-proposal-styled-parity-harness.ts`

# Tests / verification

- preview -> export request -> worker bootstrap -> print snapshot -> raster comparison completed from live artifacts
- returned PDF sha256: `a47f1d05b0d49e6b5f308b3c93254c141acb5898d06d22aeff82e5ebdb18d032`
- preview vs print diff: changed=58515, ratio=0.065625, mean=2.489
- print vs raster diff: changed=25156, ratio=0.028212, mean=1.878
- preview vs raster diff: changed=32685, ratio=0.065131, mean=2.379

# Developer debug note

- If a viewed PDF was supplied: no viewed PDF supplied
