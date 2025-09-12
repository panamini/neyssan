# v1 Typed Sections (Feature Flag)

This document describes how to enable and use the v1 typed sections (Profile, Summary, Experience, Education, Skills, Languages) in the CV editor. The v1 path is protected by a feature flag to keep legacy intact for production stability.

## Enable the Flag

Set the Vite environment variable:

- .env.local (recommended for dev)
  
  ```
  VITE_V1_SECTIONS=1
  ```

- Or start the dev server with the flag in your env.

The flag defaults:
- Dev/Test: ON by default.
- Production: OFF by default unless explicitly set to 1.

Implementation: see [`flags.ts`](my-app/src/lib/flags.ts:42)

## Where to Start

- Navigate to the workspace page (e.g., /cv) and use the “New CV (v1)” action in the toolbar.
  - This creates a fresh CV using the v1 template that includes Profile, Summary, Experience, Education, Skills, and Languages.
  - Implementation: [`cv-template.ts`](my-app/src/lib/cv-template.ts:289) (v1 template) and create path wired in context/provider.

## What’s Included

- Typed sections:
  - Profile (structured personal details)
  - Summary (structured item + linked text block)
  - Experience (structured entries with date precision + Present)
  - Education (structured entries with date precision + Present)
  - Skills (structured items)
  - Languages (structured items)

- Each Experience/Education entry has a representative text block linked via attributes.linkedStructuredId for rich-text content.

## Editing Experience/Education

- In the section header, click the pencil icon to open the typed modal (flag must be ON).
- The modal supports:
  - Multiple entries (add/remove)
  - Month/Year with optional Day for start/end dates
  - Present (isCurrent) toggle (sets endDate = null and clears end precision)
  - For Experience: an achievements textarea (one per line)
- Saving syncs structuredContent and ensures representative blocks exist/are kept, linked by linkedStructuredId.

Implementation:
- Section integration: [`SectionEditor.tsx`](my-app/src/components/SectionEditor.tsx:1204)
- Modals: [`ExperienceEducationModal.tsx`](my-app/src/components/structured-blocks/ExperienceEducationModal.tsx:1)

## Collapsed Cards

- When a typed Experience/Education section is collapsed, the editor shows:
  - Title
    - Experience: position/company
    - Education: degree/institution
  - Subtitle (company/institution • location)
  - Date range “start — end/Present” via shared formatter with precision:

Implementation:
- Collapsed rows: [`SectionEditor.tsx`](my-app/src/components/SectionEditor.tsx:1242)
- Formatter: [`date-utils.ts`](my-app/src/lib/date-utils.ts:64)

## Add Section UI

- Under the flag:
  - Mobile bottom sheet and desktop “Add Section” include Experience/Education alongside Profile, Summary, Skills, Languages.

Implementation:
- Mobile: [`AddSectionBottomSheet.tsx`](my-app/src/components/AddSectionBottomSheet.tsx:27)
- Desktop: [`ProfileReviewCard.tsx`](my-app/src/components/ProfileReviewCard.tsx:359)

## Data Model & Persistence

- Dates carry precision metadata:
  - startDatePrecision / endDatePrecision: "year" | "month" | "day"
  - isCurrent: when true, endDate = null and endDatePrecision is omitted.
- Remirror content used where needed; for Experience, responsibilities can be rich text; for Education, description can be rich text.
- Modals compose ISO date strings and precision via the shared composer.

Implementation:
- Types: [`types/cvDocument.ts`](my-app/src/types/cvDocument.ts:65)
- Formatter & helpers: [`lib/date-utils.ts`](my-app/src/lib/date-utils.ts:16)
- Normalizer compatibility: [`lib/normalize-cv.ts`](my-app/src/lib/normalize-cv.ts:118)

## Tests

- Unit tests cover precision-aware formatting and Present semantics:
  - [`typed-ee-format.test.ts`](my-app/src/__tests__/typed-ee-format.test.ts:1)

## Legacy Behavior

- When VITE_V1_SECTIONS is not enabled:
  - The UI surfaces legacy flows (including the generic inspector).
  - No mixing between v1 typed sections and legacy paths for Experience/Education under the flag.

## Quick QA Checklist

- With the flag ON:
  - New CV (v1) creates only typed sections (Profile, Summary, Experience, Education, Skills, Languages).
  - Experience/Education modals add/remove entries and persist.
  - Date inputs allow Year/Month–Year/Day precision and Present correctly shows “Present”.
  - Collapsed cards show titles, subtitles, and “start — end/Present” with expected formatting.
  - Mobile “Add Section” shows typed options; desktop dropdown shows typed options.
- With the flag OFF:
  - Legacy editor behaves as before (no regressions).

## Notes

- The feature flag limits exposure while v1 stabilizes.
- Legacy data remains compatible. Normalization adds representative blocks where needed using linkedStructuredId.