# CvForge Typography Primitives

Date: 2026-03-21

## Decision

Use shared typography primitives for active `CvForge` section surfaces instead of repeated local Tailwind text utilities.

## Applied Primitives

- `cv-section-heading`
- `cv-preview-stack`
- `cv-preview-text`
- `cv-preview-text--muted`
- `cv-preview-text--truncate`
- `cv-preview-empty`
- `cv-profile-name`
- `cv-profile-role`
- `cv-contact-links`
- `cv-contact-link`
- `cv-section-title-input`

## Why

- Reduce drift between blank and imported section states.
- Keep typography changes local to CSS primitives instead of scattered utility classes.
- Improve consistency in `SectionEditor` without touching parsing or preview architecture.

## Scope

Active code only:

- `src/components/SectionEditor.tsx`
- `src/components/cv-display/RichSummary.tsx`
- `src/styles/globals.css`

## Non-Goals

- No parsing changes
- No block architecture changes
- No modal behavior changes
