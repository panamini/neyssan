# Explicit CV Import and Proposal Patch Contract

Date: 2026-03-26

## Decision

### 1. CV Forge import stays explicit
- Decision:
  - Keep two explicit import choices in the CV Forge import dropdown.
- Options:
  - `Import with StructuredUpload`
  - `Import with Mistral OCR`
- Reason:
  - The product currently has two owned pipelines with materially different guarantees.
  - Hiding that behind a smart detector increases the risk of silently routing image PDFs into the wrong path.
  - The safer UX for now is explicit routing with clear labels.

### 2. Proposal public updates use a patch contract
- Decision:
  - `updateProposalPublic` is the public patch mutation for editable proposal fields.
- Accepted fields:
  - `title`
  - `content`
  - `sections`
  - `status`
  - `metadata`
- Reason:
  - The UI legitimately needs both title-only edits and content/status updates.
  - A content-only validator caused schema drift and broke rename/regenerate flows.
  - A patch contract is the cleanest model until separate rename/content mutations are worth the maintenance cost.

## Consequences
- CV import is clearer and safer for text PDFs vs scanned/image PDFs.
- Proposal rename and regenerate flows no longer depend on an invalid mutation payload shape.
- If the product later wants a one-click import again, it should be backed by a server-owned detector rather than a fragile client probe.

