# Smart Import And Proposal Fail-Open

Date: 2026-03-26

## Status

Accepted

## Context

- CV Forge import must not force users to understand parser-vs-OCR routing.
- Image-only PDFs must go through Mistral OCR.
- Proposal regeneration must not fail closed just because cleanup/finalization became too aggressive for a valid but thin cover-letter body.

## Decision

- CV Forge uses a single smart import trigger in the active shell.
- The client probes PDFs with browser-side text extraction.
- Routing rules:
  - text PDF -> parsing pipeline
  - image-only / near-empty PDF -> Mistral OCR
  - image files -> Mistral OCR
  - plain text -> parsing pipeline
- If the PDF probe cannot establish usable text and OCR is unavailable, the UI fails clearly instead of silently misrouting.

- Proposal finalization keeps the strict cleanup path first.
- For `cover_letter`, if aggressive/conservative/rescue cleanup removes all substantive body content, finalization now falls back to a conservative fail-open body instead of throwing immediately.
- If bridge cleanup later collapses the saved output, persistence uses the same fail-open fallback rather than fail-closing the whole regeneration.

## Consequences

- Import UX is simpler for users and safer for scanned PDFs.
- Regeneration is more resilient, especially on thin but still usable cover-letter drafts.
- The fail-open path is intentionally conservative and exists only as a last resort; the strict path remains primary.
