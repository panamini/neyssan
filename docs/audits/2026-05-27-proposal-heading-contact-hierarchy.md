# Proposal Heading Contact Hierarchy Audit

Date: 2026-05-27

## Confirmed Active Path

- ProposalForge heading drawer stores editable contact text in `proposalContactLine`.
- Proposal preview receives `contactLine` plus `applicantHeader`.
- HTML/PDF export receives the same fields through the proposal print source.
- Letterhead templates place content from the renderer/export view models.

## Problem

`applicantHeader` already has semantic fields: name, role, email, phone, LinkedIn, website, location. The Heading drawer, however, exposed only one combined contact field. If a user typed `email · phone · city · portfolio`, templates could only see a display string, not which part was telephone.

That broke the Director letterhead `T` block: `T` means telephone, but typed phone numbers in the combined line were not mapped to `candidatePhone`.

## Decision

Keep the existing persisted `proposalContactLine` schema for compatibility, but add a semantic adapter:

- `parseProposalContactLine` extracts `email`, `phone`, `location`, `linkedin`, `website`, and `other`.
- `buildProposalContactLineFromParts` writes the same combined line back in canonical order.
- The Heading drawer now exposes split contact controls backed by the same stored line.
- Preview and export derive letterhead slots from structured contact parts before falling back to the raw line.

## Current Content Priority

Applicant:

1. `applicantHeader.name` / heading applicant name
2. `applicantHeader.role` / target role
3. email
4. phone
5. location
6. LinkedIn
7. website or portfolio
8. other contact text

Recipient:

1. recipient/person or hiring team
2. role/department
3. company
4. city/location

Document:

1. subject
2. date
3. salutation
4. body
5. closing/signature

## Follow-Up

A fuller refactor should persist structured heading contact fields directly instead of reconstructing them from `proposalContactLine`. That is broader than the letterhead template branch because saved proposals, print payloads, and legacy local drafts all currently understand the combined field.
