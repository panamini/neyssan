# Shared Renderer Resume Font And Swiss Audit

Date: 2026-04-15

## Summary

Two regressions were audited on the active shared-renderer styled resume PDF path:

1. font/style changes appearing stale in exported PDF
2. Swiss Minima appearing frozen or unavailable for styled PDF export

## Findings

### Font propagation

Status by boundary:

- Preview state: correct
- Persistence to `metadata.verbatiStyle`: correct
- Styled export payload build: previously vulnerable to stale divergence because the live `stylePreset` was passed separately from the styled print source
- Print route bootstrap: correct
- `ResumePage` token/CSS resolution: correct
- Runtime font loading: correct
- Browser route render: correct

Live route probes showed:

- changing `stylePreset.typography` changes `--font-heading-family` / `--font-body-family`
- the computed text font family on `/print/resume` changes accordingly
- `document.fonts.status === "loaded"` before the page reaches `ready`

Root cause:

- the styled export payload was not self-contained
- the active export boundary relied on a separate `stylePreset` argument later in the pipeline instead of packaging the exact live preview style with the styled print source

Fix:

- move `stylePreset` and `rendererVariantId` into `ResumePreviewPrintSource`
- build the print route payload from that source directly
- expose a shared debug snapshot across export creation, worker payload creation, and print route status

### Swiss Minima

Status by boundary:

- `swiss` layout selection: correct
- `swiss -> swissminima` mapping: correct
- print route payload mapping: correct
- `ResumePage` Swiss branch: correct
- `/print/resume` Swiss render: correct

Root cause:

- styled PDF was still explicitly disabled in the active UI unless `stylePreset.layout === "two-column"`

Fix:

- remove the obsolete two-column-only styled PDF gate from the active resume export entrypoints

## Files touched

- `my-app/src/lib/document-export-models.ts`
- `my-app/scripts/document-export-worker.ts`
- `my-app/src/pages/ResumePrintPage.tsx`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/components/ProfileReviewCard.tsx`
- tests around `document-export-models`, `ResumePrintPage`, `CvForge`, and `ResumeExportControl`

## Verification

Automated:

- targeted Vitest coverage passed for:
  - styled payload modeling
  - print route status/snapshot behavior
  - resume export UI behavior
  - export control behavior
- `tsc --noEmit` passed

Live shared-renderer checks:

- `/print/resume` with Swiss payload reached `ready` and rendered `.resume-page--swissminima`
- styled resume PDF export returned `200 OK` for:
  - two-column + `quiet-editorial`
  - two-column + `mono-signal`
  - Swiss + `quiet-editorial`
- the two typography variants produced different PDF hashes and sizes, confirming PDF output changes with the selected font/style inputs

## Decision

The fixes stay at the real shared-renderer boundary:

- self-contained styled print payload
- shared route/worker parity visibility
- Swiss export enablement in the active UI

No fallback renderer, export-only font override, or Swiss normalization workaround was introduced.
