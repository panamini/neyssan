# Text-First Export Architecture Decision

Date: 2026-04-13

## Decision
- Adopt a unified direct-download export API for final document exports:
  - resume ATS PDF
  - resume styled PDF
  - proposal ATS PDF
  - proposal styled PDF
  - proposal DOCX
- Use normalized source models as the only content source:
  - `ResumePrintSource`
  - `ProposalPrintSource`
- Use Robial 17/18 as the single export page geometry system.
- Generate downloadable files through FastAPI-hosted endpoints.
- Generate PDF as real text via headless Chromium.
- Generate proposal DOCX from normalized structured data, not from HTML scraping.

## Rationale
- Existing proposal export was rasterized and preview-DOM-coupled.
- Existing resume ATS export was already structurally sound and worth preserving.
- A unified API reduces mode drift and keeps ATS/styled variants on the same content source.
- Robial 17/18 gives one stable export geometry contract across PDF and DOCX.

## Architecture

### Source Of Truth
- Resume export source is built from:
  - authoritative Mistral model first when trusted
  - standard normalized CV mapping otherwise
- Proposal export source is built from saved/compose proposal state and semantic header/body fields.
- Final export renderers reject DOM nodes, selectors, refs, and preview snapshots as content input.

### Styling Responsibility Split
- Robial governs export page geometry only:
  - margins
  - columns
  - gutters
  - modular page rhythm
- `stylePreset` governs:
  - typography
  - palette
  - emphasis
  - ornament
- `stylePreset` does not own margins.

### Runtime
- Frontend calls `exportDocumentFile(...)`.
- FastAPI validates the normalized payload and returns a direct file response with `Content-Disposition`.
- A Node worker reuses shared TypeScript renderers to produce:
  - PDF through Playwright/Chromium `page.pdf()`
  - DOCX through `docx`

## Migration Notes

### Old
- Resume PDF mixed schema-driven exports with UI-specific controls.
- Proposal PDF depended on mounted preview DOM and raster screenshot capture.

### New
- Resume ATS and styled PDFs both start from `ResumePrintSource`.
- Proposal ATS PDF, styled PDF, and DOCX all start from `ProposalPrintSource`.
- Proposal no longer uses preview settle retries or selector-based screenshot export.
- Export renderers are separate from preview renderers.

## Remaining Compromises
- The worker intentionally does not embed local Vite-discovered font asset URLs; it resolves stable font-family stacks instead.
- Browser/runtime differences can still affect exact font substitution in PDF.
- DOCX follows Robial margins and structural rhythm closely, but cannot match CSS-grade layout parity exactly.
