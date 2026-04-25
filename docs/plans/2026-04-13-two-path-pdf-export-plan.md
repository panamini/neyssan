# Export Implementation Checklist

Date: 2026-04-13

## Completed
- Added shared Robial export contract in code.
- Added unified export API for direct-download files.
- Added normalized resume and proposal export source builders.
- Added dedicated export renderers for:
  - resume ATS PDF
  - resume styled PDF
  - proposal ATS PDF
  - proposal styled PDF
- Added proposal DOCX builder.
- Added FastAPI export endpoints.
- Added Node export worker.
- Replaced active proposal screenshot export path.
- Split resume toolbar into ATS and styled PDF actions.
- Split proposal actions into ATS PDF, styled PDF, and DOCX.
- Added targeted tests for routing and contract enforcement.

## Manual QA Checklist
- Text is selectable in resume ATS PDF.
- Text is searchable in resume ATS PDF.
- Text is selectable in resume styled PDF.
- Text is searchable in resume styled PDF.
- Text is selectable in proposal ATS PDF.
- Text is searchable in proposal ATS PDF.
- Text is selectable in proposal styled PDF.
- Text is searchable in proposal styled PDF.
- A4 geometry is correct.
- Margins are physically consistent in mm.
- Styled output follows the active style preset closely.
- ATS output remains visually simpler and parse-friendly.
- Proposal DOCX opens correctly in Word.
- Proposal DOCX opens correctly in LibreOffice.
- Proposal DOCX opens correctly in Google Docs.
- Downloaded filenames are correct.
- Robial margins and columns are applied consistently.
- No alternative grid remains in export code.

## Remaining Validation Steps For Future Changes
- Compare styled PDF against live preview whenever a style preset changes.
- Re-run end-to-end smoke on all export endpoints when font/runtime dependencies change.
